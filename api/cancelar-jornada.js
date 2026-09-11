import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { enviarCorreo, escaparHtml } from './_lib/email.js';

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { jornada_id } = req.body ?? {};
    if (!jornada_id) return res.status(400).json({ error: 'Falta jornada_id' });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: jornada, error: errorJornada } = await supabaseAdmin.from('jornadas').select('id, nombre, estatus').eq('id', jornada_id).single();
    if (errorJornada) throw errorJornada;
    if (!jornada) return res.status(404).json({ error: 'La jornada no existe' });
    if (jornada.estatus === 'finalizada') return res.status(409).json({ error: 'No se puede cancelar una jornada ya finalizada' });
    if (jornada.estatus === 'cancelada') return res.status(409).json({ error: 'Esta jornada ya está cancelada' });

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

    const avisos = [];
    async function intentar(etiqueta, fn) {
      try {
        await fn();
      } catch (e) {
        console.error(`cancelar-jornada (${jornada_id}) — falló ${etiqueta}:`, e.message);
        avisos.push(`${etiqueta}: ${e.message}`);
      }
    }

    const { data: quinielas } = await supabaseAdmin.from('quinielas').select('usuario_id, alias, correo_contacto').eq('jornada_id', jornada_id);
    for (const quiniela of quinielas ?? []) {
      let correo = quiniela.correo_contacto;
      if (quiniela.usuario_id) {
        await intentar(`resolver correo de ${quiniela.alias ?? 'una entrada'}`, async () => {
          const { data: cuenta } = await supabaseAdmin.auth.admin.getUserById(quiniela.usuario_id);
          correo = cuenta?.user?.email ?? correo;
        });
      }
      if (!correo) continue;
      await intentar(`avisar a ${quiniela.alias ?? 'una entrada'}`, () => enviarCorreo({
        to: correo,
        subject: `Jornada cancelada: ${jornada.nombre}`,
        heading: '⚠️ Esta jornada fue cancelada',
        bodyHtml: `<p>La jornada <b>${escaparHtml(jornada.nombre)}</b> fue cancelada por el administrador.</p><p>Tu entrada "${escaparHtml(quiniela.alias ?? 'Entrada')}" ya no participa.</p>`,
      }));
    }

    return res.status(200).json({ status: 'ok', avisos: avisos.length ? avisos : undefined });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
