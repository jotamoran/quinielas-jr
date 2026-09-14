import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { findFixtures, findNextRound, seasonForDate, seasonRangeForDate } from './_lib/football/provider.js';
import { LIGAS } from './_lib/ligas.js';
import { guardarEnCache } from './_lib/football/equiposCache.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function ligaParaBusquedaPorRonda(leagues, mensajeMultiplesLigas) {
  if (leagues.length !== 1) throw new ErrorHttp(400, mensajeMultiplesLigas);
  const [league] = leagues;
  if (!LIGAS[league].soportaBusquedaPorJornada) throw new ErrorHttp(400, 'Esa liga todavía no soporta búsqueda por jornada');
  return league;
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    const leagues = [...new Set(String(req.query.leagues ?? '').split(',').filter(Boolean))];
    if (!leagues.length) return res.status(400).json({ error: 'Debes indicar al menos una liga' });
    if (leagues.some((id) => !LIGAS[id])) return res.status(400).json({ error: 'La liga solicitada no está permitida' });

    if (req.query.proximaJornada === '1') {
      const league = ligaParaBusquedaPorRonda(leagues, 'La detección de jornada solo admite una liga a la vez');
      return res.status(200).json({ numeroJornada: await findNextRound(league) });
    }

    const { numeroJornada } = req.query;
    if (numeroJornada) {
      if (!/^[1-9]\d*$/.test(numeroJornada)) return res.status(400).json({ error: 'El número de jornada debe ser un entero positivo' });
      const league = ligaParaBusquedaPorRonda(leagues, 'La búsqueda por jornada solo admite una liga a la vez');

      const hoy = new Date().toISOString().slice(0, 10);
      const fixtures = await findFixtures({ league, round: numeroJornada, season: seasonRangeForDate(hoy) });
      const results = fixtures.map((fixture) => ({ ...fixture, league: { ...fixture.league, name: LIGAS[league].name } }));
      results.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
      await guardarEnCache(results.flatMap((f) => [f.teams.home, f.teams.away]));
      return res.status(200).json({ fixtures: results });
    }

    const { from, to } = req.query;
    if (!DATE_PATTERN.test(from ?? '') || !DATE_PATTERN.test(to ?? '') || from > to) {
      return res.status(400).json({ error: 'El rango de fechas no es válido' });
    }

    const results = [];
    for (const league of leagues) {
      const fixtures = await findFixtures({
        league,
        season: seasonForDate(from, LIGAS[league].seasonMode),
        from,
        to,
        timezone: 'America/Mexico_City',
      });
      results.push(...fixtures.map((fixture) => ({
        ...fixture,
        league: { ...fixture.league, name: LIGAS[league].name },
      })));
    }
    results.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    await guardarEnCache(results.flatMap((f) => [f.teams.home, f.teams.away]));
    return res.status(200).json({ fixtures: results });
  } catch (error) {
    const status = error instanceof ErrorHttp ? error.status : 500;
    return res.status(status).json({ error: error.message });
  }
}
