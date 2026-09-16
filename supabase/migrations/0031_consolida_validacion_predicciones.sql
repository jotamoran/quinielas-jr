-- La validación de pronósticos (conteo, formato L/E/V, duplicados, pertenencia
-- a la jornada) estaba reimplementada por separado en registrar_quiniela_atomica,
-- actualizar_predicciones_atomica y registrar_quiniela_presencial_atomica, y ya
-- habían divergido: a las dos últimas les faltaba el chequeo de pronóstico NULL
-- que sí tenía la primera. Se factoriza en una sola función para que las tres
-- compartan exactamente la misma regla.
CREATE OR REPLACE FUNCTION _validar_predicciones_jornada(p_jornada_id UUID, p_predicciones JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_partidos_activos INTEGER;
  v_predicciones INTEGER;
BEGIN
  IF p_predicciones IS NULL OR jsonb_typeof(p_predicciones) <> 'array' THEN
    RAISE EXCEPTION 'Los pronósticos no son válidos';
  END IF;

  SELECT COUNT(*) INTO v_partidos_activos
  FROM partidos WHERE jornada_id = p_jornada_id AND cancelado = false;

  SELECT COUNT(*) INTO v_predicciones
  FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT);

  IF v_partidos_activos = 0 OR v_predicciones <> v_partidos_activos THEN
    RAISE EXCEPTION 'Debes completar todos los pronósticos';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
    WHERE item.partido_id IS NULL OR item.pronostico IS NULL OR item.pronostico NOT IN ('L', 'E', 'V')
  ) THEN
    RAISE EXCEPTION 'Los pronósticos no son válidos';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
    GROUP BY item.partido_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'No puede haber partidos repetidos';
  END IF;
  -- Con el conteo exacto y sin duplicados ya verificados arriba, que cada
  -- pronóstico apunte a un partido activo de esta jornada basta (por
  -- pigeonhole) para garantizar que cubren exactamente los partidos activos.
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
    LEFT JOIN partidos p ON p.id = item.partido_id
    WHERE p.id IS NULL OR p.jornada_id <> p_jornada_id OR p.cancelado
  ) THEN
    RAISE EXCEPTION 'Los pronósticos no corresponden a la jornada';
  END IF;

  RETURN v_predicciones;
END;
$$;

REVOKE ALL ON FUNCTION _validar_predicciones_jornada(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _validar_predicciones_jornada(UUID, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION registrar_quiniela_atomica(
  p_jornada_id UUID,
  p_alias TEXT,
  p_metodo_pago TEXT,
  p_monto_pagado NUMERIC,
  p_comprobante_url TEXT,
  p_predicciones JSONB,
  p_codigo_cupon TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario UUID := auth.uid();
  v_jornada jornadas%ROWTYPE;
  v_quiniela quinielas%ROWTYPE;
  v_cupon cupones%ROWTYPE;
  v_codigo TEXT := NULLIF(UPPER(TRIM(p_codigo_cupon)), '');
  v_metodo TEXT := LOWER(TRIM(p_metodo_pago));
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para registrar una quiniela';
  END IF;
  IF NULLIF(TRIM(p_alias), '') IS NULL OR LENGTH(TRIM(p_alias)) > 40 THEN
    RAISE EXCEPTION 'El nombre de la entrada no es válido';
  END IF;
  IF v_metodo IS NULL OR v_metodo NOT IN ('transferencia', 'efectivo', 'cupon') THEN
    RAISE EXCEPTION 'El método de pago no es válido';
  END IF;
  IF v_metodo <> 'cupon' AND (p_monto_pagado IS NULL OR p_monto_pagado < 0) THEN
    RAISE EXCEPTION 'El monto de pago no es válido';
  END IF;
  IF v_metodo = 'cupon' AND v_codigo IS NULL THEN
    RAISE EXCEPTION 'Debes indicar un código de cupón';
  END IF;
  IF v_metodo <> 'cupon' AND v_codigo IS NOT NULL THEN
    RAISE EXCEPTION 'El cupón solo puede usarse con el método de pago cupón';
  END IF;

  SELECT * INTO v_jornada
  FROM jornadas
  WHERE id = p_jornada_id
  FOR SHARE;
  IF NOT FOUND OR v_jornada.estatus <> 'activa' OR v_jornada.fecha_cierre <= NOW() THEN
    RAISE EXCEPTION 'La jornada ya no admite quinielas';
  END IF;

  PERFORM _validar_predicciones_jornada(p_jornada_id, p_predicciones);

  IF v_metodo = 'cupon' THEN
    SELECT * INTO v_cupon
    FROM cupones
    WHERE codigo = v_codigo AND usuario_id = v_usuario AND estatus = 'activo'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupón inválido o ya utilizado';
    END IF;
  END IF;

  INSERT INTO quinielas (
    usuario_id, jornada_id, alias, estatus_pago, metodo_pago,
    monto_pagado, comprobante_url
  ) VALUES (
    v_usuario, p_jornada_id, TRIM(p_alias),
    CASE WHEN v_metodo = 'cupon' THEN 'aprobado' ELSE 'pendiente' END,
    v_metodo,
    CASE WHEN v_metodo = 'cupon' THEN 0 ELSE p_monto_pagado END,
    p_comprobante_url
  )
  RETURNING * INTO v_quiniela;

  INSERT INTO predicciones (quiniela_id, partido_id, pronostico)
  SELECT v_quiniela.id, item.partido_id, item.pronostico
  FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT);

  IF v_metodo = 'cupon' THEN
    UPDATE cupones
    SET estatus = 'usado', usado_en_quiniela_id = v_quiniela.id, usado_el = NOW()
    WHERE id = v_cupon.id;
  END IF;

  RETURN TO_JSONB(v_quiniela);
END;
$$;

CREATE OR REPLACE FUNCTION actualizar_predicciones_atomica(
  p_quiniela_id UUID,
  p_predicciones JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario UUID := auth.uid();
  v_jornada_id UUID;
  v_estatus TEXT;
  v_fecha_cierre TIMESTAMPTZ;
  v_predicciones INTEGER;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para actualizar tus pronósticos';
  END IF;

  SELECT jornada_id INTO v_jornada_id
  FROM quinielas
  WHERE id = p_quiniela_id AND usuario_id = v_usuario;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La quiniela no existe o no te pertenece';
  END IF;

  SELECT estatus, fecha_cierre INTO v_estatus, v_fecha_cierre
  FROM jornadas WHERE id = v_jornada_id FOR SHARE;
  IF v_estatus IS DISTINCT FROM 'activa' OR v_fecha_cierre IS NULL OR v_fecha_cierre <= NOW() THEN
    RAISE EXCEPTION 'La jornada ya no admite cambios';
  END IF;

  v_predicciones := _validar_predicciones_jornada(v_jornada_id, p_predicciones);

  UPDATE predicciones AS p
  SET pronostico = item.pronostico
  FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
  WHERE p.quiniela_id = p_quiniela_id AND p.partido_id = item.partido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La quiniela no tiene pronósticos para actualizar';
  END IF;
  RETURN jsonb_build_object('actualizados', v_predicciones);
END;
$$;

CREATE OR REPLACE FUNCTION registrar_quiniela_presencial_atomica(
  p_admin_id UUID,
  p_jornada_id UUID,
  p_alias TEXT,
  p_correo_contacto TEXT,
  p_estatus_pago TEXT,
  p_predicciones JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jornada jornadas%ROWTYPE;
  v_quiniela quinielas%ROWTYPE;
  v_correo TEXT := NULLIF(TRIM(p_correo_contacto), '');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM perfiles WHERE id = p_admin_id AND rol = 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF NULLIF(TRIM(p_alias), '') IS NULL OR LENGTH(TRIM(p_alias)) > 40 THEN
    RAISE EXCEPTION 'El nombre de la entrada no es válido';
  END IF;
  IF p_estatus_pago IS NULL OR p_estatus_pago NOT IN ('pendiente', 'aprobado', 'rechazado') THEN
    RAISE EXCEPTION 'El estatus del pago no es válido';
  END IF;
  IF v_correo IS NOT NULL AND v_correo !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'El correo de contacto no es válido';
  END IF;
  SELECT * INTO v_jornada FROM jornadas WHERE id = p_jornada_id FOR SHARE;
  IF NOT FOUND OR v_jornada.estatus IS DISTINCT FROM 'activa' OR v_jornada.fecha_cierre IS NULL OR v_jornada.fecha_cierre <= NOW() THEN
    RAISE EXCEPTION 'La jornada ya no admite quinielas';
  END IF;

  PERFORM _validar_predicciones_jornada(p_jornada_id, p_predicciones);

  INSERT INTO quinielas (
    usuario_id, jornada_id, alias, correo_contacto, estatus_pago, metodo_pago,
    monto_pagado, revisado_por, revisado_el, origen
  ) VALUES (
    NULL, p_jornada_id, TRIM(p_alias), v_correo, p_estatus_pago, 'efectivo',
    CASE WHEN p_estatus_pago = 'aprobado' THEN v_jornada.costo ELSE 0 END,
    CASE WHEN p_estatus_pago = 'aprobado' THEN p_admin_id ELSE NULL END,
    CASE WHEN p_estatus_pago = 'aprobado' THEN NOW() ELSE NULL END,
    'manual_admin'
  ) RETURNING * INTO v_quiniela;

  INSERT INTO predicciones (quiniela_id, partido_id, pronostico)
  SELECT v_quiniela.id, item.partido_id, item.pronostico
  FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT);

  RETURN TO_JSONB(v_quiniela);
END;
$$;
