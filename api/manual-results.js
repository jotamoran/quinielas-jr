import { requireAdmin, responderError } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

const RESULTADOS_VALIDOS = new Set(['L', 'E', 'V']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { jornada_id: jornadaId, resultados } = req.body ?? {};
    if (!jornadaId || !UUID.test(jornadaId) || !Array.isArray(resultados) || !resultados.length || resultados.length > 9) {
      return res.status(400).json({ error: 'Debes indicar la jornada y al menos un resultado' });
    }
    if (resultados.some((item) => !UUID.test(item?.partido_id ?? '') || !RESULTADOS_VALIDOS.has(item.resultado))) {
      return res.status(400).json({ error: 'Los resultados enviados no son válidos' });
    }
    if (new Set(resultados.map((item) => item.partido_id)).size !== resultados.length) {
      return res.status(400).json({ error: 'Hay partidos repetidos en los resultados' });
    }

    const supabase = getSupabaseAdmin();
    const { data: actualizados, error } = await supabase.rpc('aplicar_resultados_partidos', {
      p_jornada_id: jornadaId,
      p_resultados: resultados.map(({ partido_id, resultado }) => ({ partido_id, resultado })),
      p_solo_pendientes: true,
    });
    if (error) throw error;
    return res.status(200).json({ status: 'ok', actualizados });
  } catch (error) {
    return responderError(res, error, 'api/manual-results');
  }
}
