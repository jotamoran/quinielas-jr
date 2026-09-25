-- Un pago por transferencia puede cubrir varias quinielas de la misma jornada.
CREATE TABLE pagos_transferencia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  jornada_id UUID NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
  comprobante_url TEXT NOT NULL,
  monto_total NUMERIC(10,2) NOT NULL CHECK (monto_total > 0),
  notificado_el TIMESTAMPTZ,
  creado_el TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quinielas
  ADD COLUMN pago_transferencia_id UUID REFERENCES pagos_transferencia(id) ON DELETE RESTRICT,
  ADD COLUMN notificacion_admin_el TIMESTAMPTZ;

CREATE INDEX idx_quinielas_pago_transferencia ON quinielas(pago_transferencia_id);

ALTER TABLE pagos_transferencia ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION registrar_quinielas_transferencia_atomica(
  p_jornada_id UUID,
  p_quinielas JSONB,
  p_comprobante_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario UUID := auth.uid();
  v_jornada jornadas%ROWTYPE;
  v_pago_id UUID;
  v_quiniela quinielas%ROWTYPE;
  v_entrada JSONB;
  v_resultados JSONB := '[]'::JSONB;
  v_cantidad INTEGER;
  v_alias TEXT;
  v_predicciones JSONB;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para registrar una quiniela';
  END IF;

  IF jsonb_typeof(p_quinielas) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Las quinielas no son válidas';
  END IF;

  v_cantidad := jsonb_array_length(p_quinielas);
  IF v_cantidad < 1 OR v_cantidad > 10 THEN
    RAISE EXCEPTION 'Puedes registrar entre 1 y 10 quinielas por transferencia';
  END IF;

  IF NULLIF(TRIM(p_comprobante_url), '') IS NULL
    OR p_comprobante_url NOT LIKE v_usuario::TEXT || '/%' THEN
    RAISE EXCEPTION 'El comprobante no es válido';
  END IF;

  SELECT * INTO v_jornada
  FROM jornadas
  WHERE id = p_jornada_id
  FOR SHARE;
  IF NOT FOUND OR v_jornada.estatus <> 'activa' OR v_jornada.fecha_cierre <= NOW() THEN
    RAISE EXCEPTION 'La jornada ya no admite quinielas';
  END IF;

  INSERT INTO pagos_transferencia (usuario_id, jornada_id, comprobante_url, monto_total)
  VALUES (v_usuario, p_jornada_id, p_comprobante_url, v_jornada.costo * v_cantidad)
  RETURNING id INTO v_pago_id;

  FOR v_entrada IN SELECT value FROM jsonb_array_elements(p_quinielas)
  LOOP
    v_alias := NULLIF(TRIM(v_entrada->>'alias'), '');
    v_predicciones := v_entrada->'predicciones';

    IF v_alias IS NULL OR LENGTH(v_alias) > 40 THEN
      RAISE EXCEPTION 'El nombre de una entrada no es válido';
    END IF;

    PERFORM _validar_predicciones_jornada(p_jornada_id, v_predicciones);

    INSERT INTO quinielas (
      usuario_id, jornada_id, alias, estatus_pago, metodo_pago,
      monto_pagado, comprobante_url, pago_transferencia_id
    ) VALUES (
      v_usuario, p_jornada_id, v_alias, 'pendiente', 'transferencia',
      v_jornada.costo, p_comprobante_url, v_pago_id
    )
    RETURNING * INTO v_quiniela;

    INSERT INTO predicciones (quiniela_id, partido_id, pronostico)
    SELECT v_quiniela.id, item.partido_id, item.pronostico
    FROM jsonb_to_recordset(v_predicciones) AS item(partido_id UUID, pronostico TEXT);

    v_resultados := v_resultados || jsonb_build_array(jsonb_build_object(
      'id', v_quiniela.id,
      'alias', v_quiniela.alias
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'pago_transferencia_id', v_pago_id,
    'quinielas', v_resultados,
    'cantidad', v_cantidad,
    'monto_total', v_jornada.costo * v_cantidad
  );
END;
$$;

REVOKE ALL ON FUNCTION registrar_quinielas_transferencia_atomica(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_quinielas_transferencia_atomica(UUID, JSONB, TEXT) TO authenticated;
