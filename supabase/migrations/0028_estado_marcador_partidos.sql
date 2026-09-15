ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS puntos_local INTEGER,
  ADD COLUMN IF NOT EXISTS puntos_visitante INTEGER,
  ADD COLUMN IF NOT EXISTS actualizado_el TIMESTAMPTZ;

ALTER TABLE partidos DROP CONSTRAINT IF EXISTS partidos_estado_check;
ALTER TABLE partidos ADD CONSTRAINT partidos_estado_check
  CHECK (estado IN ('pendiente', 'en_vivo', 'finalizado'));

UPDATE partidos
SET estado = CASE
  WHEN cancelado THEN 'pendiente'
  WHEN resultado_oficial IS NOT NULL THEN 'finalizado'
  ELSE 'pendiente'
END
WHERE estado IS NULL OR estado NOT IN ('pendiente', 'en_vivo', 'finalizado');

CREATE INDEX IF NOT EXISTS idx_partidos_estado ON partidos(jornada_id, estado);
