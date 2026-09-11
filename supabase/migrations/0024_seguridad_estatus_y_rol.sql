-- supabase/migrations/0024_seguridad_estatus_y_rol.sql

-- Las políticas de predicciones solo validaban que no hubiera pasado la
-- fecha de cierre, no que la jornada siguiera activa. Cierra el hueco de
-- que, en el instante entre crear la quiniela e insertar los pronósticos,
-- una jornada recién cancelada todavía aceptara predicciones.
DROP POLICY "insertar antes del cierre" ON predicciones;
CREATE POLICY "insertar antes del cierre" ON predicciones FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quinielas q JOIN jornadas j ON j.id = q.jornada_id
      WHERE q.id = predicciones.quiniela_id AND q.usuario_id = auth.uid() AND j.estatus = 'activa' AND j.fecha_cierre > NOW()
    )
  );

DROP POLICY "actualizar antes del cierre" ON predicciones;
CREATE POLICY "actualizar antes del cierre" ON predicciones FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quinielas q JOIN jornadas j ON j.id = q.jornada_id
      WHERE q.id = predicciones.quiniela_id AND q.usuario_id = auth.uid() AND j.estatus = 'activa' AND j.fecha_cierre > NOW()
    )
  );

-- La política de UPDATE de perfiles permite escribir cualquier columna de
-- la propia fila, incluyendo `rol` — un usuario normal podía autopromoverse
-- a admin. Este trigger lo bloquea salvo que quien hace el cambio ya sea
-- admin.
CREATE OR REPLACE FUNCTION prevenir_cambio_de_rol()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol IS DISTINCT FROM OLD.rol AND NOT es_admin() THEN
    RAISE EXCEPTION 'No autorizado para cambiar el rol';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER prevenir_cambio_de_rol_trigger
BEFORE UPDATE ON perfiles
FOR EACH ROW EXECUTE FUNCTION prevenir_cambio_de_rol();
