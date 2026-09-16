-- Centraliza las escrituras de pronósticos y registros presenciales.
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
  v_partidos_activos INTEGER;
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
  IF p_predicciones IS NULL OR jsonb_typeof(p_predicciones) <> 'array' THEN
    RAISE EXCEPTION 'Los pronósticos no son válidos';
  END IF;

  SELECT COUNT(*) INTO v_partidos_activos
  FROM partidos WHERE jornada_id = v_jornada_id AND cancelado = false;
  SELECT COUNT(*) INTO v_predicciones
  FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT);

  IF v_partidos_activos = 0 OR v_predicciones <> v_partidos_activos THEN
    RAISE EXCEPTION 'Debes completar todos los pronósticos';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
    WHERE item.partido_id IS NULL OR item.pronostico NOT IN ('L', 'E', 'V')
  ) THEN
    RAISE EXCEPTION 'Los pronósticos no son válidos';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
    GROUP BY item.partido_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'No puede haber partidos repetidos';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
    LEFT JOIN partidos p ON p.id = item.partido_id
    WHERE p.id IS NULL OR p.jornada_id <> v_jornada_id OR p.cancelado
  ) THEN
    RAISE EXCEPTION 'Los pronósticos no corresponden a la jornada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM partidos p
    WHERE p.jornada_id = v_jornada_id AND p.cancelado = false
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
        WHERE item.partido_id = p.id
      )
  ) THEN
    RAISE EXCEPTION 'Los pronósticos no corresponden a la jornada';
  END IF;

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

REVOKE ALL ON FUNCTION actualizar_predicciones_atomica(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION actualizar_predicciones_atomica(UUID, JSONB) TO authenticated;

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
  v_partidos_activos INTEGER;
  v_predicciones INTEGER;
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
  IF p_predicciones IS NULL OR jsonb_typeof(p_predicciones) <> 'array' THEN
    RAISE EXCEPTION 'Los pronósticos no son válidos';
  END IF;

  SELECT COUNT(*) INTO v_partidos_activos FROM partidos WHERE jornada_id = p_jornada_id AND cancelado = false;
  SELECT COUNT(*) INTO v_predicciones FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT);
  IF v_partidos_activos = 0 OR v_predicciones <> v_partidos_activos THEN
    RAISE EXCEPTION 'Debes completar todos los pronósticos';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
    WHERE item.partido_id IS NULL OR item.pronostico NOT IN ('L', 'E', 'V')
  ) THEN
    RAISE EXCEPTION 'Los pronósticos no son válidos';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
    GROUP BY item.partido_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'No puede haber partidos repetidos';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
    LEFT JOIN partidos p ON p.id = item.partido_id
    WHERE p.id IS NULL OR p.jornada_id <> p_jornada_id OR p.cancelado
  ) THEN
    RAISE EXCEPTION 'Los pronósticos no corresponden a la jornada';
  END IF;

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

REVOKE ALL ON FUNCTION registrar_quiniela_presencial_atomica(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_quiniela_presencial_atomica(UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- Un partido cancelado no conserva marcador ni resultado oficial.
CREATE OR REPLACE FUNCTION limpiar_resultado_partido_cancelado()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.cancelado THEN
    NEW.resultado_oficial := NULL;
    NEW.estado := 'pendiente';
    NEW.puntos_local := NULL;
    NEW.puntos_visitante := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS limpiar_resultado_partido_cancelado_trigger ON partidos;
CREATE TRIGGER limpiar_resultado_partido_cancelado_trigger
BEFORE INSERT OR UPDATE OF cancelado, resultado_oficial, estado, puntos_local, puntos_visitante ON partidos
FOR EACH ROW EXECUTE FUNCTION limpiar_resultado_partido_cancelado();

-- Mantiene los aciertos consistentes aunque una integración actualice partidos directamente.
DROP TRIGGER IF EXISTS recalcular_puntos_al_cancelar_partido ON partidos;
DROP TRIGGER IF EXISTS recalcular_puntos_al_actualizar_resultado ON partidos;
CREATE OR REPLACE FUNCTION recalcular_puntos_al_actualizar_partido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM calcular_puntos(NEW.jornada_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER recalcular_puntos_al_actualizar_resultado
AFTER UPDATE OF resultado_oficial, cancelado ON partidos
FOR EACH ROW
WHEN (OLD.resultado_oficial IS DISTINCT FROM NEW.resultado_oficial OR OLD.cancelado IS DISTINCT FROM NEW.cancelado)
EXECUTE FUNCTION recalcular_puntos_al_actualizar_partido();

-- Refuerza las mismas restricciones que el frontend aplica al comprobante.
UPDATE storage.buckets
SET file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
WHERE id = 'comprobantes';
