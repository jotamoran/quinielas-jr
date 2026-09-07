import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

function mapearResultado(golesLocal, golesVisitante) {
  if (golesLocal > golesVisitante) return 'L';
  if (golesLocal < golesVisitante) return 'V';
  return 'E';
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { jornada_id } = req.body;
    if (!jornada_id) return res.status(400).json({ error: 'Falta jornada_id' });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: partidos, error } = await supabaseAdmin
      .from('partidos')
      .select('id, api_fixture_id')
      .eq('jornada_id', jornada_id)
      .not('api_fixture_id', 'is', null);
    if (error) throw error;

    for (const partido of partidos) {
      const url = `https://www.thesportsdb.com/api/v1/json/${process.env.SPORTSDB_API_KEY}/lookupevent.php?id=${partido.api_fixture_id}`;
      const respuesta = await fetch(url);
      const datos = await respuesta.json();
      const evento = datos.events?.[0];
      if (!evento || evento.strStatus !== 'FT') continue;

      const resultado = mapearResultado(Number(evento.intHomeScore), Number(evento.intAwayScore));
      await supabaseAdmin.from('partidos').update({ resultado_oficial: resultado }).eq('id', partido.id);
    }

    await supabaseAdmin.rpc('calcular_puntos', { p_jornada_id: jornada_id });

    return res.status(200).json({ status: 'ok' });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
