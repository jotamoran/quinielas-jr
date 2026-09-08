DROP POLICY "usuario inserta las suyas" ON quinielas;
CREATE POLICY "usuario inserta las suyas" ON quinielas FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND estatus_pago = 'pendiente'
    AND aciertos = 0
    AND EXISTS (
      SELECT 1
      FROM jornadas j
      WHERE j.id = jornada_id
        AND j.estatus = 'activa'
        AND j.fecha_cierre > NOW()
    )
  );

CREATE VIEW vista_pronosticos_publicos
WITH (security_barrier = true) AS
SELECT
  q.jornada_id,
  q.id AS quiniela_id,
  p.partido_id,
  p.pronostico
FROM predicciones p
JOIN quinielas q ON q.id = p.quiniela_id
JOIN jornadas j ON j.id = q.jornada_id
WHERE q.estatus_pago = 'aprobado'
  AND j.fecha_cierre <= NOW();

GRANT SELECT ON vista_pronosticos_publicos TO anon, authenticated;

CREATE OR REPLACE VIEW vista_ranking_publica AS
SELECT
  jornada_id,
  COALESCE(alias, nombre_completo) AS mostrar_como,
  aciertos,
  posicion,
  quiniela_id
FROM vista_ranking_jornada;

GRANT SELECT ON vista_ranking_publica TO anon, authenticated;
