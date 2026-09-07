CREATE TABLE partidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE CASCADE,
  api_fixture_id INT UNIQUE,
  api_league_id INT NOT NULL,
  liga_nombre TEXT,
  equipo_local TEXT NOT NULL,
  logo_local TEXT,
  equipo_visitante TEXT NOT NULL,
  logo_visitante TEXT,
  fecha_partido TIMESTAMPTZ NOT NULL,
  resultado_oficial TEXT CHECK (resultado_oficial IN ('L','E','V'))
);
CREATE INDEX idx_partidos_jornada ON partidos(jornada_id);
