import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { buscarEnCache, guardarEnCache } from './_lib/football/equiposCache.js';

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
    const search = String(req.query.search ?? '').trim();
    if (search.length < 2 || search.length > 80) return res.status(400).json({ error: 'Escribe al menos 2 caracteres' });

    let desdeCache = [];
    try {
      desdeCache = await buscarEnCache(search);
    } catch (e) {
      console.error('api/teams: falló buscarEnCache', e.message);
    }
    if (desdeCache.length) {
      return res.status(200).json({ teams: desdeCache.map((e) => ({ id: e.id_externo, name: e.nombre, logo: e.logo })) });
    }

    const key = process.env.SPORTSDB_API_KEY || '123';
    const response = await fetch(`https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php?t=${encodeURIComponent(search)}`);
    if (!response.ok) throw new Error(`TheSportsDB respondió ${response.status}`);
    const payload = await response.json();
    const teams = (payload.teams ?? [])
      .filter((team) => !team.strSport || team.strSport === 'Soccer')
      .map((team) => ({ id: String(team.idTeam), name: team.strTeam, logo: team.strBadge || team.strTeamBadge || null }))
      .slice(0, 10);

    await guardarEnCache(teams);
    return res.status(200).json({ teams });
  } catch (error) {
    const status = error instanceof ErrorHttp ? error.status : 500;
    return res.status(status).json({ error: error.message });
  }
}
