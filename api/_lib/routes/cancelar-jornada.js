import { requireAdmin, responderError } from '../auth.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { escaparHtml } from '../email.js';
import { enviarAvisoUnico } from '../avisoUnico.js';

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { jornada_id, reenviar_avisos: reenviar = false } = req.body ?? {};
    if (!jornada_id) return res.status(400).json({ error: 'Falta jornada_id' });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: jornada, error: errorJornada } = await supabaseAdmin.from('jornadas').select('id, nombre, estatus').eq('id', jornada_id).maybeSingle();
    if (errorJornada) throw errorJornada;
    if (!jornada) return res.status(404).json({ error: 'La jornada no existe' });
    if (jornada.estatus === 'finalizada') return res.status(409).json({ error: 'No se puede cancelar una jornada ya finalizada' });
    if (jornada.estatus === 'cancelada' && !reenviar) return res.status(409).json({ error: 'Esta jornada ya está cancelada' });
    if (jornada.estatus !== 'cancelada' && reenviar) return res.status(409).json({ error: 'Solo se pueden reenviar los avisos de una jornada cancelada' });

    if (!reenviar) {
      const { data: cancelada, error: errorCancelar } = await supabaseAdmin
        .from('jornadas')
        .update({ estatus: 'cancelada' })
        .eq('id', jornada_id)
        .neq('estatus', 'finalizada')
        .neq('estatus', 'cancelada')
        .select('id')
        .maybeSingle();
      if (errorCancelar) throw errorCancelar;
      if (!cancelada) return res.status(409).json({ error: 'Esta jornada ya no se puede cancelar' });
    }

    const avisos = [];
    async function avisar(etiqueta, clave, preparar) {
      try {
        const correo = await preparar();
        if (!correo) return;
        const enviado = await enviarAvisoUnico(supabaseAdmin, `cancelacion:${jornada_id}:${clave}`, correo);
        if (!enviado) avisos.push(`${etiqueta}: envío en curso`);
      } catch (e) {
        console.error(`cancelar-jornada (${jornada_id}) — falló ${etiqueta}:`, e.message);
        avisos.push(`${etiqueta}: ${e.message}`);
      }
    }

    const { data: quinielas, error: errorQuinielas } = await supabaseAdmin.from('quinielas').select('id, usuario_id, alias, correo_contacto').eq('jornada_id', jornada_id);
    if (errorQuinielas) {
      console.error(`cancelar-jornada (${jornada_id}) — no se pudieron consultar participantes:`, errorQuinielas.message);
      avisos.push('No se pudo obtener la lista completa de participantes para enviar avisos.');
    }
    for (const quiniela of quinielas ?? []) {
      await avisar(`avisar a ${quiniela.alias ?? 'una entrada'}`, quiniela.id, async () => {
        let correo = quiniela.correo_contacto;
        if (quiniela.usuario_id) {
          const { data: cuenta, error } = await supabaseAdmin.auth.admin.getUserById(quiniela.usuario_id);
          if (error) throw error;
          correo = cuenta?.user?.email ?? correo;
        }
        if (!correo) return null;
        return {
          to: correo,
          subject: `Jornada cancelada: ${jornada.nombre}`,
          heading: '⚠️ Esta jornada fue cancelada',
          bodyHtml: `<p>La jornada <b>${escaparHtml(jornada.nombre)}</b> fue cancelada por el administrador.</p><p>Tu entrada "${escaparHtml(quiniela.alias ?? 'Entrada')}" ya no participa.</p>`,
        };
      });
    }

    return res.status(200).json({ status: 'ok', avisos: avisos.length ? avisos : undefined });
  } catch (e) {
    return responderError(res, e, 'cancelar-jornada');
  }
}
