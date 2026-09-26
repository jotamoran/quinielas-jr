-- La tabla pública muestra aciertos provisionales durante los partidos en vivo.
-- quinielas.aciertos conserva únicamente los aciertos de resultados oficiales.
CREATE OR REPLACE VIEW vista_ranking_publica AS
WITH resultados_para_tabla AS (
  SELECT
    p.id AS partido_id,
    CASE
      WHEN p.cancelado THEN NULL
      WHEN p.resultado_oficial IS NOT NULL THEN p.resultado_oficial
      WHEN p.estado = 'en_vivo'
        AND p.puntos_local IS NOT NULL
        AND p.puntos_visitante IS NOT NULL
      THEN CASE
        WHEN p.puntos_local > p.puntos_visitante THEN 'L'
        WHEN p.puntos_local < p.puntos_visitante THEN 'V'
        ELSE 'E'
      END
      ELSE NULL
    END AS resultado
  FROM partidos p
), aciertos_provisionales AS (
  SELECT
    q.jornada_id,
    q.id AS quiniela_id,
    COALESCE(q.alias, pf.nombre_completo) AS mostrar_como,
    COUNT(*) FILTER (WHERE r.resultado = pr.pronostico)::INTEGER AS aciertos
  FROM quinielas q
  LEFT JOIN perfiles pf ON pf.id = q.usuario_id
  LEFT JOIN predicciones pr ON pr.quiniela_id = q.id
  LEFT JOIN resultados_para_tabla r ON r.partido_id = pr.partido_id
  WHERE q.estatus_pago = 'aprobado'
  GROUP BY q.jornada_id, q.id, q.alias, pf.nombre_completo
)
SELECT
  jornada_id,
  mostrar_como,
  aciertos,
  RANK() OVER (PARTITION BY jornada_id ORDER BY aciertos DESC) AS posicion,
  quiniela_id
FROM aciertos_provisionales;

GRANT SELECT ON vista_ranking_publica TO anon, authenticated;
