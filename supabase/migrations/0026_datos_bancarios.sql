-- supabase/migrations/0026_datos_bancarios.sql
CREATE TABLE datos_bancarios (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  banco TEXT,
  clabe TEXT,
  titular TEXT,
  actualizado_el TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO datos_bancarios (id) VALUES (1);

ALTER TABLE datos_bancarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura para autenticados" ON datos_bancarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "solo admin escribe" ON datos_bancarios FOR ALL TO authenticated USING (es_admin()) WITH CHECK (es_admin());
