import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { findFixtures, seasonForDate } from './_lib/football/provider.js';
import { LIGAS } from './_lib/ligas.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    const leagues = [...new Set(String(req.query.leagues ?? '').split(',').filter(Boolean))];
    const { from, to } = req.query;
    if (!leagues.length) return res.status(400).json({ error: 'Debes indicar al menos una liga' });
    if (!DATE_PATTERN.test(from ?? '') || !DATE_PATTERN.test(to ?? '') || from > to) {
      return res.status(400).json({ error: 'El rango de fechas no es válido' });
    }
    if (leagues.some((id) => !LIGAS[id])) return res.status(400).json({ error: 'La liga solicitada no está permitida' });

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
    return res.status(200).json({ fixtures: results });
  } catch (error) {
    const status = error instanceof ErrorHttp ? error.status : 500;
    return res.status(status).json({ error: error.message });
  }
}
