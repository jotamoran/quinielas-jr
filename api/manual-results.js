import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

const RESULTADOS_VALIDOS = new Set(['L', 'E', 'V']);

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { jornada_id: jornadaId, resultados } = req.body ?? {};
    if (!jornadaId || !Array.isArray(resultados) || !resultados.length || resultados.length > 9) {
      return res.status(400).json({ error: 'Debes indicar la jornada y al menos un resultado' });
    }
    if (resultados.some((item) => !item.partido_id || !RESULTADOS_VALIDOS.has(item.resultado))) {
      return res.status(400).json({ error: 'Los resultados enviados no son válidos' });
    }

    const ids = [...new Set(resultados.map((item) => item.partido_id))];
    const supabase = getSupabaseAdmin();
    const { data: jornada, error: jornadaError } = await supabase.from('jornadas').select('estatus').eq('id', jornadaId).single();
    if (jornadaError) throw jornadaError;
    if (jornada.estatus === 'finalizada') return res.status(409).json({ error: 'No se puede modificar una jornada finalizada' });
    const { data: partidos, error: partidosError } = await supabase
      .from('partidos')
      .select('id')
      .eq('jornada_id', jornadaId)
      .in('id', ids);
    if (partidosError) throw partidosError;
    if (partidos.length !== ids.length) return res.status(400).json({ error: 'Uno o más partidos no pertenecen a la jornada' });

    for (const item of resultados) {
      const { error } = await supabase
        .from('partidos')
        .update({ resultado_oficial: item.resultado })
        .eq('id', item.partido_id)
        .eq('jornada_id', jornadaId);
      if (error) throw error;
    }

    const { error: rpcError } = await supabase.rpc('calcular_puntos', { p_jornada_id: jornadaId });
    if (rpcError) throw rpcError;
    return res.status(200).json({ status: 'ok', actualizados: resultados.length });
  } catch (error) {
    const status = error instanceof ErrorHttp ? error.status : 500;
    return res.status(status).json({ error: error.message });
  }
}
