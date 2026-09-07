-- Cierra hueco de RLS: un usuario podía insertar su propia quiniela ya con
-- estatus_pago='aprobado' y/o aciertos>0, saltándose el flujo de pago/aprobación admin.
DROP POLICY "usuario inserta las suyas" ON quinielas;
CREATE POLICY "usuario inserta las suyas" ON quinielas FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() AND estatus_pago = 'pendiente' AND aciertos = 0);
