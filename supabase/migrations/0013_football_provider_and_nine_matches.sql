ALTER TABLE partidos
  ADD COLUMN provider TEXT,
  ADD COLUMN external_fixture_id TEXT,
  ADD COLUMN external_league_id TEXT;

UPDATE partidos
SET provider = 'thesportsdb',
    external_fixture_id = api_fixture_id::TEXT,
    external_league_id = api_league_id::TEXT
WHERE api_fixture_id IS NOT NULL;

ALTER TABLE partidos ALTER COLUMN api_league_id DROP NOT NULL;
CREATE UNIQUE INDEX idx_partidos_provider_fixture
  ON partidos(provider, external_fixture_id)
  WHERE provider IS NOT NULL AND external_fixture_id IS NOT NULL;

ALTER TABLE jornadas DROP CONSTRAINT jornadas_estatus_check;
ALTER TABLE jornadas ADD CONSTRAINT jornadas_estatus_check
  CHECK (estatus IN ('borrador', 'activa', 'cerrada', 'finalizada'));

CREATE OR REPLACE FUNCTION validar_nueve_partidos_jornada()
RETURNS trigger AS $$
BEGIN
  IF NEW.estatus = 'activa' AND OLD.estatus IS DISTINCT FROM 'activa' AND
     (SELECT COUNT(*) FROM partidos WHERE jornada_id = NEW.id) <> 9 THEN
    RAISE EXCEPTION 'Una jornada activa debe tener exactamente 9 partidos';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TRIGGER validar_nueve_partidos_antes_de_publicar
BEFORE UPDATE OF estatus ON jornadas
FOR EACH ROW EXECUTE FUNCTION validar_nueve_partidos_jornada();
