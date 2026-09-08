DROP INDEX IF EXISTS idx_partidos_provider_fixture;

CREATE UNIQUE INDEX idx_partidos_jornada_provider_fixture
  ON partidos(jornada_id, provider, external_fixture_id)
  WHERE provider IS NOT NULL AND external_fixture_id IS NOT NULL;
