CREATE VIEW vista_ranking_jornada AS
SELECT
  q.jornada_id,
  q.id AS quiniela_id,
  q.usuario_id,
  pf.nombre_completo,
  q.alias,
  q.aciertos,
  RANK() OVER (PARTITION BY q.jornada_id ORDER BY q.aciertos DESC) AS posicion
FROM quinielas q
JOIN perfiles pf ON pf.id = q.usuario_id
WHERE q.estatus_pago = 'aprobado';

CREATE VIEW vista_ranking_publica AS
SELECT
  jornada_id,
  COALESCE(alias, nombre_completo) AS mostrar_como,
  aciertos,
  posicion
FROM vista_ranking_jornada;
