import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { buscarEnCache, guardarEnCache } from './_lib/football/equiposCache.js';

const REQUEST_TIMEOUT_MS = 8000;
const MAX_REINTENTOS = 2;

async function buscarEquiposExternos(search, key) {
  let ultimoError;
  for (let intento = 0; intento <= MAX_REINTENTOS; intento += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php?t=${encodeURIComponent(search)}`, { signal: controller.signal });
      if (response.status === 429 || response.status >= 500) throw new Error(`Respuesta temporal ${response.status}`);
      if (!response.ok) throw new Error(`El servicio de equipos respondió ${response.status}`);
      return await response.json();
    } catch (error) {
      ultimoError = error.name === 'AbortError' ? new Error('El servicio de equipos tardó demasiado en responder') : error;
      if (intento === MAX_REINTENTOS) throw ultimoError;
      await new Promise((resolve) => setTimeout(resolve, 250 * (intento + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw ultimoError;
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
    const search = String(req.query.search ?? '').trim();
    if (search.length < 2 || search.length > 80) return res.status(400).json({ error: 'Escribe al menos 2 caracteres' });
    const key = process.env.SPORTSDB_API_KEY?.trim();
    if (!key) throw new Error('Falta configurar SPORTSDB_API_KEY');

    let desdeCache = [];
    try {
      desdeCache = await buscarEnCache(search);
    } catch (e) {
      console.error('api/teams: falló buscarEnCache', e.message);
    }
    if (desdeCache.length) {
      return res.status(200).json({ teams: desdeCache.map((e) => ({ id: e.id_externo ?? e.nombre, name: e.nombre, logo: e.logo })) });
    }

    const payload = await buscarEquiposExternos(search, key);
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
