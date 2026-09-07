import { requireAdmin, ErrorHttp } from './_lib/auth.js';

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    const { leagues, season, from, to } = req.query;
    const ligas = String(leagues ?? '').split(',').filter(Boolean);
    if (ligas.length === 0) return res.status(400).json({ error: 'Debes indicar al menos una liga' });

    const resultados = await Promise.all(ligas.map(async (liga) => {
      const url = new URL('https://v3.football.api-sports.io/fixtures');
      url.searchParams.set('league', liga);
      url.searchParams.set('season', season);
      url.searchParams.set('from', from);
      url.searchParams.set('to', to);

      const respuesta = await fetch(url, { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY } });
      const datos = await respuesta.json();
      return datos.response ?? [];
    }));

    return res.status(200).json({ fixtures: resultados.flat() });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
