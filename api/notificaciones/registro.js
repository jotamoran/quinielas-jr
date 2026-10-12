import { requireUser, responderError } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { escaparHtml } from '../_lib/email.js';
import { enviarAvisoUnico } from '../_lib/avisoUnico.js';

async function correoDelDueno(supabaseAdmin, quiniela, user) {
  if (!quiniela.usuario_id) return quiniela.correo_contacto ?? null;
  if (quiniela.usuario_id === user.id) return user.email;
  const { data: cuenta, error } = await supabaseAdmin.auth.admin.getUserById(quiniela.usuario_id);
  if (error) throw error;
  return cuenta?.user?.email ?? null;
}

export default async function handler(req, res) {
  try {
    const { user, perfil } = await requireUser(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { quiniela_id } = req.body ?? {};
    if (!quiniela_id) return res.status(400).json({ error: 'Falta quiniela_id' });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: quiniela } = await supabaseAdmin
      .from('quinielas')
      .select('usuario_id, alias, metodo_pago, monto_pagado, estatus_pago, jornada_id, correo_contacto, jornadas(nombre)')
      .eq('id', quiniela_id)
      .single();

    if (!quiniela || (quiniela.usuario_id !== user.id && perfil?.rol !== 'admin')) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const avisoEfectivo = quiniela.metodo_pago === 'efectivo'
      ? '<p><b>Importante:</b> tu quiniela queda pendiente hasta confirmar tu pago en efectivo. Si no se paga, no estarás participando en el sorteo.</p>'
      : '';
    let avisosPendientes = false;

    const correoUsuario = await correoDelDueno(supabaseAdmin, quiniela, user);
    if (correoUsuario) {
      try {
        const enviado = await enviarAvisoUnico(supabaseAdmin, `registro:${quiniela_id}:usuario`, {
          to: correoUsuario,
          subject: `Quiniela registrada: ${quiniela.jornadas?.nombre ?? ''}`,
          heading: '¡Tu quiniela quedó registrada!',
          bodyHtml: `<p>Jornada: <b>${escaparHtml(quiniela.jornadas?.nombre)}</b></p>
        <p>Entrada: ${escaparHtml(quiniela.alias ?? 'Entrada')}</p>
        <p>Método de pago: ${quiniela.metodo_pago}</p>
        <p>Monto: $${Number(quiniela.monto_pagado ?? 0).toFixed(2)}</p>
        <p>Estatus: ${quiniela.estatus_pago}</p>
        ${avisoEfectivo}`,
        });
        if (!enviado) avisosPendientes = true;
      } catch (error) {
        avisosPendientes = true;
        console.error(`notificaciones/registro: falló el aviso al usuario de la entrada ${quiniela_id}`, error.message);
      }
    }

    const { data: admins, error: adminsError } = await supabaseAdmin.from('perfiles').select('id').eq('rol', 'admin');
    if (adminsError) throw adminsError;
    for (const admin of admins ?? []) {
      try {
        const { data: cuenta, error: cuentaError } = await supabaseAdmin.auth.admin.getUserById(admin.id);
        if (cuentaError) throw cuentaError;
        const correoAdmin = cuenta?.user?.email;
        if (!correoAdmin) continue;
        const enviado = await enviarAvisoUnico(supabaseAdmin, `registro:${quiniela_id}:admin:${admin.id}`, {
          to: correoAdmin,
          subject: `Nueva quiniela registrada: ${quiniela.jornadas?.nombre ?? ''}`,
          heading: '📋 Nueva quiniela registrada',
          bodyHtml: `<p>Alguien acaba de registrar una quiniela.</p>
          <p>Jornada: <b>${escaparHtml(quiniela.jornadas?.nombre)}</b></p>
          <p>Entrada: ${escaparHtml(quiniela.alias ?? 'Entrada')}</p>
          <p>Método de pago: ${quiniela.metodo_pago}</p>
          <p>Estatus: ${quiniela.estatus_pago}</p>`,
        });
        if (!enviado) avisosPendientes = true;
      } catch (error) {
        avisosPendientes = true;
        console.error(`notificaciones/registro: falló el aviso al admin ${admin.id}`, error.message);
      }
    }

    if (avisosPendientes) {
      return res.status(503).json({ error: 'Quedaron avisos pendientes. Puedes reintentar sin reenviar los que ya se enviaron.' });
    }
    return res.status(200).json({ status: 'ok' });
  } catch (e) {
    return responderError(res, e, 'notificaciones/registro');
  }
}
