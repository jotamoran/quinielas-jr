CREATE OR REPLACE FUNCTION recalcular_al_cancelar_partido()
RETURNS trigger AS $$
BEGIN
  PERFORM calcular_puntos(NEW.jornada_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER recalcular_puntos_al_cancelar_partido
AFTER UPDATE OF cancelado ON partidos
FOR EACH ROW
WHEN (OLD.cancelado IS DISTINCT FROM NEW.cancelado)
EXECUTE FUNCTION recalcular_al_cancelar_partido();

CREATE UNIQUE INDEX idx_cupones_uno_por_jornada
  ON cupones(jornada_origen_id)
  WHERE jornada_origen_id IS NOT NULL;
