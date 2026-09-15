-- Una jornada cerrada es el registro histórico de resultados y ya no admite cambios.
CREATE OR REPLACE FUNCTION proteger_jornada_historica()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estatus IN ('finalizada', 'cancelada') THEN
    RAISE EXCEPTION 'La jornada ya es de solo consulta';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS proteger_jornada_historica_trigger ON jornadas;
CREATE TRIGGER proteger_jornada_historica_trigger
BEFORE UPDATE OR DELETE ON jornadas
FOR EACH ROW EXECUTE FUNCTION proteger_jornada_historica();

CREATE OR REPLACE FUNCTION proteger_partido_de_jornada_historica()
RETURNS TRIGGER AS $$
DECLARE
  estatus_jornada TEXT;
BEGIN
  SELECT estatus INTO estatus_jornada FROM jornadas WHERE id = OLD.jornada_id;
  IF estatus_jornada IN ('finalizada', 'cancelada') THEN
    RAISE EXCEPTION 'Los partidos de una jornada finalizada son de solo consulta';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.jornada_id IS DISTINCT FROM OLD.jornada_id THEN
    SELECT estatus INTO estatus_jornada FROM jornadas WHERE id = NEW.jornada_id;
  END IF;
  IF estatus_jornada IN ('finalizada', 'cancelada') THEN
    RAISE EXCEPTION 'Los partidos de una jornada finalizada son de solo consulta';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS proteger_partido_de_jornada_historica_trigger ON partidos;
CREATE TRIGGER proteger_partido_de_jornada_historica_trigger
BEFORE UPDATE OR DELETE ON partidos
FOR EACH ROW EXECUTE FUNCTION proteger_partido_de_jornada_historica();
