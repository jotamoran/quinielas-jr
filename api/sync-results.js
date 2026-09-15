import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { findFinalResults, FOOTBALL_PROVIDER } from './_lib/football/provider.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

async function sincronizarJornada(supabase, jornadaId) {
  const { data: partidos, error } = await supabase
    .from('partidos')
    .select('id, external_fixture_id, resultado_oficial, estado')
    .eq('jornada_id', jornadaId)
    .eq('provider', FOOTBALL_PROVIDER)
    .not('external_fixture_id', 'is', null)
    .eq('cancelado', false);
  if (error) throw error;
  if (!partidos?.length) return { revisados: 0, actualizados: 0 };
  const results = await findFinalResults(partidos.map((partido) => partido.external_fixture_id));
  let actualizados = 0;
  for (const partido of partidos) {
    const resultado = results.get(String(partido.external_fixture_id));
    if (!resultado) continue;
    if (resultado === partido.resultado_oficial && partido.estado === 'finalizado') continue;
    const { error: updateError } = await supabase.from('partidos').update({
      resultado_oficial: resultado,
      estado: 'finalizado',
      actualizado_el: new Date().toISOString(),
    }).eq('id', partido.id);
    if (updateError) throw updateError;
    actualizados += 1;
  }
  if (actualizados) {
    const { error: rpcError } = await supabase.rpc('calcular_puntos', { p_jornada_id: jornadaId });
    if (rpcError) throw rpcError;
  }
  return { revisados: partidos.length, actualizados };
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    const supabase = getSupabaseAdmin();
    const { jornada_id: jornadaId } = req.body ?? {};
    if (!jornadaId) return res.status(400).json({ error: 'Falta jornada_id' });
    const { data: jornada, error: jornadaError } = await supabase.from('jornadas').select('estatus').eq('id', jornadaId).maybeSingle();
    if (jornadaError) throw jornadaError;
    if (!jornada) return res.status(404).json({ error: 'La jornada no existe' });
    if (['finalizada', 'cancelada'].includes(jornada.estatus)) return res.status(409).json({ error: 'La jornada ya es de solo consulta' });
    const resultado = await sincronizarJornada(supabase, jornadaId);
    return res.status(200).json({ status: 'ok', ...resultado });
  } catch (error) {
    const status = error instanceof ErrorHttp ? error.status : 500;
    return res.status(status).json({ error: error.message });
  }
}
