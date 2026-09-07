-- perfiles
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select propio o admin" ON perfiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR es_admin());
CREATE POLICY "update solo propio" ON perfiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- jornadas
ALTER TABLE jornadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura publica jornadas" ON jornadas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "solo admin escribe jornadas" ON jornadas FOR ALL TO authenticated
  USING (es_admin()) WITH CHECK (es_admin());

-- partidos
ALTER TABLE partidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura publica partidos" ON partidos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "solo admin escribe partidos" ON partidos FOR ALL TO authenticated
  USING (es_admin()) WITH CHECK (es_admin());

-- quinielas
ALTER TABLE quinielas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario ve las suyas o admin ve todas" ON quinielas FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR es_admin());
CREATE POLICY "usuario inserta las suyas" ON quinielas FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "solo admin actualiza" ON quinielas FOR UPDATE TO authenticated
  USING (es_admin()) WITH CHECK (es_admin());

-- predicciones
ALTER TABLE predicciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver predicciones propias o admin" ON predicciones FOR SELECT TO authenticated
  USING (
    es_admin() OR EXISTS (SELECT 1 FROM quinielas q WHERE q.id = predicciones.quiniela_id AND q.usuario_id = auth.uid())
  );
CREATE POLICY "insertar antes del cierre" ON predicciones FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quinielas q JOIN jornadas j ON j.id = q.jornada_id
      WHERE q.id = predicciones.quiniela_id AND q.usuario_id = auth.uid() AND j.fecha_cierre > NOW()
    )
  );
CREATE POLICY "actualizar antes del cierre" ON predicciones FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quinielas q JOIN jornadas j ON j.id = q.jornada_id
      WHERE q.id = predicciones.quiniela_id AND q.usuario_id = auth.uid() AND j.fecha_cierre > NOW()
    )
  );

-- cupones
ALTER TABLE cupones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario ve sus cupones o admin ve todos" ON cupones FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR es_admin());

-- vistas: se exponen explícitamente para el ranking (ver nota debajo sobre RLS)
GRANT SELECT ON vista_ranking_jornada TO authenticated;
GRANT SELECT ON vista_ranking_publica TO anon, authenticated;

-- Storage: bucket privado de comprobantes
INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes', 'comprobantes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "usuario sube su comprobante" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "usuario lee su comprobante" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
