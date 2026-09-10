-- supabase/migrations/0020_cancelar_partido.sql
ALTER TABLE partidos ADD COLUMN cancelado BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION calcular_puntos(p_jornada_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE quinielas q
  SET aciertos = (
    SELECT COUNT(*)
    FROM predicciones p
    JOIN partidos pa ON pa.id = p.partido_id
    WHERE p.quiniela_id = q.id
      AND pa.cancelado = false
      AND pa.resultado_oficial IS NOT NULL
      AND pa.resultado_oficial = p.pronostico
  )
  WHERE q.jornada_id = p_jornada_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
