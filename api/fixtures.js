import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { NOMBRES_LIGAS } from './_lib/ligas.js';

// Trae los próximos partidos de una liga en TheSportsDB y los normaliza al
// mismo formato { fixture, league, teams } que ya consume el resto de la app
// (adminService.js / GestionJornadas.vue), para no tener que tocar nada más.
async function obtenerProximosPartidos(idLiga, desde, hasta) {
  const url = `https://www.thesportsdb.com/api/v1/json/${process.env.SPORTSDB_API_KEY}/eventsnextleague.php?id=${idLiga}`;
  const respuesta = await fetch(url);
  const datos = await respuesta.json();
  const eventos = datos.events ?? [];

  return eventos
    .filter((e) => (!desde || e.dateEvent >= desde) && (!hasta || e.dateEvent <= hasta))
    .map((e) => ({
      fixture: { id: e.idEvent, date: `${e.dateEvent}T${e.strTime}` },
      league: { id: e.idLeague, name: NOMBRES_LIGAS[e.idLeague] ?? e.strLeague },
      teams: {
        home: { name: e.strHomeTeam, logo: e.strHomeTeamBadge },
        away: { name: e.strAwayTeam, logo: e.strAwayTeamBadge },
      },
    }));
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    const { leagues, from, to } = req.query;
    const ligas = String(leagues ?? '').split(',').filter(Boolean);
    if (ligas.length === 0) return res.status(400).json({ error: 'Debes indicar al menos una liga' });

    const resultados = await Promise.all(ligas.map((liga) => obtenerProximosPartidos(liga, from, to)));

    return res.status(200).json({ fixtures: resultados.flat() });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
