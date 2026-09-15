import { findFinalResults, FOOTBALL_PROVIDER } from './_lib/football/provider.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

async function sincronizarJornada(supabase, jornada) {
  const { data: partidos, error } = await supabase
    .from('partidos')
    .select('id, external_fixture_id')
    .eq('jornada_id', jornada.id)
    .eq('provider', FOOTBALL_PROVIDER)
    .is('resultado_oficial', null)
    .not('external_fixture_id', 'is', null)
    .eq('cancelado', false);
  if (error) throw error;
  if (!partidos?.length) return { revisados: 0, actualizados: 0 };
  const results = await findFinalResults(partidos.map((partido) => partido.external_fixture_id));
  let actualizados = 0;
  for (const partido of partidos) {
    const resultado = results.get(String(partido.external_fixture_id));
    if (!resultado) continue;
    const { error: updateError } = await supabase.from('partidos').update({ resultado_oficial: resultado }).eq('id', partido.id);
    if (updateError) throw updateError;
    actualizados += 1;
  }
  if (actualizados) {
    const { error: rpcError } = await supabase.rpc('calcular_puntos', { p_jornada_id: jornada.id });
    if (rpcError) throw rpcError;
  }
  return { revisados: partidos.length, actualizados };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'No autorizado' });
  try {
    const supabase = getSupabaseAdmin();
    const { data: jornadas, error } = await supabase.from('jornadas').select('id').in('estatus', ['activa', 'cerrada']);
    if (error) throw error;
    const resumen = { jornadas: jornadas?.length ?? 0, revisados: 0, actualizados: 0, errores: [] };
    for (const jornada of jornadas ?? []) {
      try {
        const resultado = await sincronizarJornada(supabase, jornada);
        resumen.revisados += resultado.revisados;
        resumen.actualizados += resultado.actualizados;
      } catch (errorJornada) {
        resumen.errores.push({ jornadaId: jornada.id, error: errorJornada.message });
      }
    }
    return res.status(200).json({ status: 'ok', ...resumen });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudo sincronizar' });
  }
}
