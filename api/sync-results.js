import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { findFinalResults, FOOTBALL_PROVIDER } from './_lib/football/provider.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    const { jornada_id: jornadaId } = req.body ?? {};
    if (!jornadaId) return res.status(400).json({ error: 'Falta jornada_id' });

    const supabase = getSupabaseAdmin();
    const { data: partidos, error } = await supabase
      .from('partidos')
      .select('id, external_fixture_id')
      .eq('jornada_id', jornadaId)
      .eq('provider', FOOTBALL_PROVIDER)
      .is('resultado_oficial', null)
      .not('external_fixture_id', 'is', null);
    if (error) throw error;

    const results = await findFinalResults(partidos.map((partido) => partido.external_fixture_id));
    let actualizados = 0;
    for (const partido of partidos) {
      const resultado = results.get(String(partido.external_fixture_id));
      if (!resultado) continue;
      const { error: updateError } = await supabase.from('partidos').update({ resultado_oficial: resultado }).eq('id', partido.id);
      if (updateError) throw updateError;
      actualizados += 1;
    }

    const { error: rpcError } = await supabase.rpc('calcular_puntos', { p_jornada_id: jornadaId });
    if (rpcError) throw rpcError;
    return res.status(200).json({ status: 'ok', revisados: partidos.length, actualizados });
  } catch (error) {
    const status = error instanceof ErrorHttp ? error.status : 500;
    return res.status(status).json({ error: error.message });
  }
}
