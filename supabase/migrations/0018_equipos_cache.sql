-- supabase/migrations/0018_equipos_cache.sql
CREATE TABLE equipos_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  nombre_normalizado TEXT NOT NULL UNIQUE,  -- lower(trim(nombre)); clave del upsert y de la búsqueda
  logo TEXT,
  id_externo TEXT,                          -- idTeam de TheSportsDB, cuando venga de búsqueda manual (nullable)
  actualizado_el TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_equipos_cache_normalizado ON equipos_cache (nombre_normalizado);

ALTER TABLE equipos_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "solo admin usa equipos_cache" ON equipos_cache FOR ALL TO authenticated
  USING (es_admin()) WITH CHECK (es_admin());
