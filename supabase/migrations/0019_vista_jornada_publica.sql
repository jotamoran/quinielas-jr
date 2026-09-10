-- Oculta el premio en la vista pública de resultados hasta que cierre el
-- registro, del lado del servidor (antes solo se ocultaba en la UI, pero la
-- consulta seguía trayendo el monto real al navegador). Mismo patrón que
-- vista_pronosticos_publicos: gateado por fecha_cierre <= NOW().
CREATE VIEW vista_jornada_publica AS
SELECT
  id,
  nombre,
  fecha_cierre,
  estatus,
  CASE WHEN fecha_cierre <= NOW() THEN premio ELSE NULL END AS premio
FROM jornadas;

GRANT SELECT ON vista_jornada_publica TO anon, authenticated;
