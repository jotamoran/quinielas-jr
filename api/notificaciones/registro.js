import { requireUser, ErrorHttp } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { enviarCorreo, escaparHtml } from '../_lib/email.js';

async function notificarAdmin(supabaseAdmin, { alias, metodoPago, estatusPago, jornadaNombre }) {
  const { data: admins } = await supabaseAdmin.from('perfiles').select('id').eq('rol', 'admin');
  for (const admin of admins ?? []) {
    try {
      const { data: cuenta } = await supabaseAdmin.auth.admin.getUserById(admin.id);
      const correoAdmin = cuenta?.user?.email;
      if (!correoAdmin) continue;
      await enviarCorreo({
        to: correoAdmin,
        subject: `Nueva quiniela registrada: ${jornadaNombre}`,
        heading: '📋 Nueva quiniela registrada',
        bodyHtml: `<p>Alguien acaba de registrar una quiniela.</p>
          <p>Jornada: <b>${escaparHtml(jornadaNombre)}</b></p>
          <p>Entrada: ${escaparHtml(alias ?? 'Entrada')}</p>
          <p>Método de pago: ${metodoPago}</p>
          <p>Estatus: ${estatusPago}</p>`,
      });
    } catch (error) {
      console.error(`notificaciones/registro: falló el aviso al admin ${admin.id}`, error.message);
    }
  }
}

export default async function handler(req, res) {
  try {
    const { user, perfil } = await requireUser(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { quiniela_id } = req.body;
    if (!quiniela_id) return res.status(400).json({ error: 'Falta quiniela_id' });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: quiniela } = await supabaseAdmin
      .from('quinielas')
      .select('usuario_id, alias, metodo_pago, monto_pagado, estatus_pago, jornada_id, jornadas(nombre)')
      .eq('id', quiniela_id)
      .single();

    if (!quiniela || (quiniela.usuario_id !== user.id && perfil?.rol !== 'admin')) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const avisoEfectivo = quiniela.metodo_pago === 'efectivo'
      ? '<p><b>Importante:</b> tu quiniela queda pendiente hasta confirmar tu pago en efectivo. Si no se paga, no estarás participando en el sorteo.</p>'
      : '';

    await enviarCorreo({
      to: user.email,
      subject: `Quiniela registrada: ${quiniela.jornadas?.nombre ?? ''}`,
      heading: '¡Tu quiniela quedó registrada!',
      bodyHtml: `<p>Jornada: <b>${escaparHtml(quiniela.jornadas?.nombre)}</b></p>
        <p>Entrada: ${escaparHtml(quiniela.alias ?? 'Entrada')}</p>
        <p>Método de pago: ${quiniela.metodo_pago}</p>
        <p>Monto: $${Number(quiniela.monto_pagado ?? 0).toFixed(2)}</p>
        <p>Estatus: ${quiniela.estatus_pago}</p>
        ${avisoEfectivo}`,
    });

    try {
      await notificarAdmin(supabaseAdmin, {
        alias: quiniela.alias,
        metodoPago: quiniela.metodo_pago,
        estatusPago: quiniela.estatus_pago,
        jornadaNombre: quiniela.jornadas?.nombre ?? '',
      });
    } catch (avisoError) {
      console.error('notificaciones/registro: falló el aviso al admin', avisoError.message);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
