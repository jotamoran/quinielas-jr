-- Registra una entrada, sus pronósticos y, si aplica, el cupón en una sola transacción.
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
  v_partidos_activos INTEGER;
  v_predicciones INTEGER;
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
  IF p_predicciones IS NULL OR jsonb_typeof(p_predicciones) <> 'array' THEN
    RAISE EXCEPTION 'Los pronósticos no son válidos';
  END IF;

  SELECT * INTO v_jornada
  FROM jornadas
  WHERE id = p_jornada_id
  FOR SHARE;
  IF NOT FOUND OR v_jornada.estatus <> 'activa' OR v_jornada.fecha_cierre <= NOW() THEN
    RAISE EXCEPTION 'La jornada ya no admite quinielas';
  END IF;

  SELECT COUNT(*) INTO v_partidos_activos
  FROM partidos
  WHERE jornada_id = p_jornada_id AND cancelado = false;

  SELECT COUNT(*) INTO v_predicciones
  FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT);
  IF v_partidos_activos = 0 OR v_predicciones <> v_partidos_activos THEN
    RAISE EXCEPTION 'Debes completar todos los pronósticos';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
    WHERE item.partido_id IS NULL OR item.pronostico IS NULL OR item.pronostico NOT IN ('L', 'E', 'V')
  ) THEN
    RAISE EXCEPTION 'Los pronósticos no son válidos';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
    GROUP BY item.partido_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'No puede haber partidos repetidos';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM partidos partido
    WHERE partido.jornada_id = p_jornada_id AND partido.cancelado = false
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_predicciones) AS item(partido_id UUID, pronostico TEXT)
        WHERE item.partido_id = partido.id
      )
  ) THEN
    RAISE EXCEPTION 'Los pronósticos no corresponden a la jornada';
  END IF;

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

REVOKE ALL ON FUNCTION registrar_quiniela_atomica(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_quiniela_atomica(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB, TEXT) TO authenticated;

-- Impide modificar entradas y pronósticos de jornadas históricas desde una llamada directa.
CREATE OR REPLACE FUNCTION proteger_quiniela_historica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_estatus TEXT;
BEGIN
  SELECT estatus INTO v_estatus FROM jornadas WHERE id = OLD.jornada_id;
  IF v_estatus IN ('finalizada', 'cancelada') THEN
    RAISE EXCEPTION 'La quiniela pertenece a una jornada de solo consulta';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.jornada_id IS DISTINCT FROM OLD.jornada_id THEN
    SELECT estatus INTO v_estatus FROM jornadas WHERE id = NEW.jornada_id;
    IF v_estatus IN ('finalizada', 'cancelada') THEN
      RAISE EXCEPTION 'La quiniela pertenece a una jornada de solo consulta';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_quiniela_historica_trigger ON quinielas;
CREATE TRIGGER proteger_quiniela_historica_trigger
BEFORE UPDATE OR DELETE ON quinielas
FOR EACH ROW EXECUTE FUNCTION proteger_quiniela_historica();

CREATE OR REPLACE FUNCTION proteger_prediccion_historica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_estatus TEXT;
  v_quiniela_id UUID := OLD.quiniela_id;
BEGIN
  SELECT j.estatus INTO v_estatus
  FROM quinielas q JOIN jornadas j ON j.id = q.jornada_id
  WHERE q.id = v_quiniela_id;
  IF v_estatus IN ('finalizada', 'cancelada') THEN
    RAISE EXCEPTION 'El pronóstico pertenece a una jornada de solo consulta';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.quiniela_id IS DISTINCT FROM OLD.quiniela_id THEN
    SELECT j.estatus INTO v_estatus
    FROM quinielas q JOIN jornadas j ON j.id = q.jornada_id
    WHERE q.id = NEW.quiniela_id;
    IF v_estatus IN ('finalizada', 'cancelada') THEN
      RAISE EXCEPTION 'El pronóstico pertenece a una jornada de solo consulta';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_prediccion_historica_trigger ON predicciones;
CREATE TRIGGER proteger_prediccion_historica_trigger
BEFORE UPDATE OR DELETE ON predicciones
FOR EACH ROW EXECUTE FUNCTION proteger_prediccion_historica();

-- Refuerza en la base la regla operativa del cierre.
CREATE OR REPLACE FUNCTION validar_cierre_jornada()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_primer_partido TIMESTAMPTZ;
BEGIN
  IF NEW.estatus IN ('activa', 'cerrada') THEN
    SELECT MIN(fecha_partido) INTO v_primer_partido
    FROM partidos
    WHERE jornada_id = NEW.id AND cancelado = false;
    IF v_primer_partido IS NOT NULL AND NEW.fecha_cierre > v_primer_partido - INTERVAL '5 minutes' THEN
      RAISE EXCEPTION 'El cierre debe quedar al menos cinco minutos antes del primer partido';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_cierre_jornada_trigger ON jornadas;
CREATE TRIGGER validar_cierre_jornada_trigger
BEFORE INSERT OR UPDATE OF fecha_cierre, estatus ON jornadas
FOR EACH ROW EXECUTE FUNCTION validar_cierre_jornada();

CREATE OR REPLACE FUNCTION validar_partido_antes_del_cierre()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jornada jornadas%ROWTYPE;
  v_primer_partido TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_jornada FROM jornadas WHERE id = NEW.jornada_id;
  IF FOUND AND v_jornada.estatus IN ('activa', 'cerrada') AND NOT NEW.cancelado THEN
    SELECT MIN(fecha_partido) INTO v_primer_partido
    FROM partidos
    WHERE jornada_id = NEW.jornada_id
      AND cancelado = false
      AND id IS DISTINCT FROM NEW.id;
    v_primer_partido := LEAST(COALESCE(v_primer_partido, NEW.fecha_partido), NEW.fecha_partido);
    IF v_jornada.fecha_cierre > v_primer_partido - INTERVAL '5 minutes' THEN
      RAISE EXCEPTION 'El cierre debe quedar al menos cinco minutos antes del primer partido';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_partido_antes_del_cierre_trigger ON partidos;
CREATE TRIGGER validar_partido_antes_del_cierre_trigger
BEFORE INSERT OR UPDATE OF jornada_id, fecha_partido, cancelado ON partidos
FOR EACH ROW EXECUTE FUNCTION validar_partido_antes_del_cierre();

-- Los datos de un partido cancelado no deben recibir resultado oficial.
DROP POLICY IF EXISTS "usuario elimina su comprobante" ON storage.objects;
CREATE POLICY "usuario elimina su comprobante" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE VIEW vista_jornada_publica AS
SELECT
  id,
  nombre,
  fecha_cierre,
  estatus,
  CASE WHEN estatus <> 'cancelada' AND fecha_cierre <= NOW() THEN premio ELSE NULL END AS premio
FROM jornadas;

CREATE OR REPLACE VIEW vista_pronosticos_publicos AS
SELECT
  q.jornada_id,
  q.id AS quiniela_id,
  p.partido_id,
  p.pronostico
FROM predicciones p
JOIN quinielas q ON q.id = p.quiniela_id
JOIN jornadas j ON j.id = q.jornada_id
WHERE q.estatus_pago = 'aprobado'
  AND j.estatus <> 'cancelada'
  AND j.fecha_cierre <= NOW();

CREATE OR REPLACE VIEW vista_ranking_publica AS
SELECT
  r.jornada_id,
  COALESCE(r.alias, r.nombre_completo) AS mostrar_como,
  r.aciertos,
  r.posicion,
  r.quiniela_id
FROM vista_ranking_jornada r
JOIN jornadas j ON j.id = r.jornada_id
WHERE j.estatus <> 'cancelada';

GRANT SELECT ON vista_jornada_publica TO anon, authenticated;
GRANT SELECT ON vista_pronosticos_publicos TO anon, authenticated;
GRANT SELECT ON vista_ranking_publica TO anon, authenticated;
