import { requireAdmin, ErrorHttp, responderError } from './_lib/auth.js';
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
  if (!partidos?.length) return { revisados: 0, actualizados: 0, fallidos: 0 };

  const results = await findFinalResults(partidos.map((partido) => partido.external_fixture_id));
  const fallidos = results.fallidos ?? [];
  if (fallidos.length === partidos.length) {
    throw new ErrorHttp(502, 'No se pudo consultar el servicio de resultados. Inténtalo de nuevo en unos minutos.');
  }

  const cambios = [];
  for (const partido of partidos) {
    const resultado = results.get(String(partido.external_fixture_id));
    if (!resultado) continue;
    if (resultado === partido.resultado_oficial && partido.estado === 'finalizado') continue;
    cambios.push({ partido_id: partido.id, resultado });
  }

  let actualizados = 0;
  if (cambios.length) {
    const { data, error: rpcError } = await supabase.rpc('aplicar_resultados_partidos', {
      p_jornada_id: jornadaId,
      p_resultados: cambios,
      p_solo_pendientes: false,
    });
    if (rpcError) throw rpcError;
    actualizados = data ?? 0;
  }
  return { revisados: partidos.length, actualizados, fallidos: fallidos.length };
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
    return res.status(200).json({ status: resultado.fallidos ? 'parcial' : 'ok', ...resultado });
  } catch (error) {
    return responderError(res, error, 'api/sync-results');
  }
}
