import { requireUser, ErrorHttp } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { escaparHtml } from '../_lib/email.js';
import { enviarAvisoTransferencia } from '../_lib/avisoTransferencia.js';

export default async function handler(req, res) {
  try {
    const { user, perfil } = await requireUser(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { pago_transferencia_id: pagoId } = req.body ?? {};
    if (!pagoId) return res.status(400).json({ error: 'Falta pago_transferencia_id' });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: pago, error: pagoError } = await supabaseAdmin
      .from('pagos_transferencia')
      .select('id, usuario_id, monto_total, notificado_el, jornadas(nombre)')
      .eq('id', pagoId)
      .single();
    if (pagoError || !pago || (pago.usuario_id !== user.id && perfil?.rol !== 'admin')) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (pago.notificado_el) return res.status(200).json({ status: 'ok', ya_notificado: true });

    const { data: quinielas, error: quinielasError } = await supabaseAdmin
      .from('quinielas')
      .select('alias')
      .eq('pago_transferencia_id', pago.id)
      .eq('estatus_pago', 'pendiente')
      .order('creado_el');
    if (quinielasError || !quinielas?.length) return res.status(409).json({ error: 'El pago ya no tiene quinielas pendientes' });

    let avisosPendientes = false;
    const { data: cuenta, error: cuentaError } = await supabaseAdmin.auth.admin.getUserById(pago.usuario_id);
    if (cuentaError) throw cuentaError;
    const { data: datosUsuario } = await supabaseAdmin.from('perfiles').select('nombre_completo, username').eq('id', pago.usuario_id).maybeSingle();
    const nombreUsuario = datosUsuario?.nombre_completo || datosUsuario?.username || cuenta?.user?.email || 'Un usuario';
    const entradas = quinielas.map((quiniela) => escaparHtml(quiniela.alias ?? 'Entrada')).join(', ');
    if (cuenta?.user?.email) {
      try {
        const enviado = await enviarAvisoTransferencia(supabaseAdmin, pago.id, `usuario:${pago.usuario_id}`, {
          to: cuenta.user.email,
          subject: `Quinielas registradas: ${pago.jornadas?.nombre ?? ""}`,
          heading: "¡Tus quinielas quedaron registradas!",
          bodyHtml: `<p>Jornada: <b>${escaparHtml(pago.jornadas?.nombre)}</b></p><p>Registraste <b>${quinielas.length} ${quinielas.length === 1 ? "quiniela" : "quinielas"}</b> mediante transferencia.</p><p>Monto: <b>$${Number(pago.monto_total).toFixed(2)}</b></p><p>Tu pago quedará pendiente hasta que sea validado.</p>`,
        });
        if (!enviado) avisosPendientes = true;
      } catch (error) {
        avisosPendientes = true;
        console.error(`notificaciones/pago-transferencia: falló el aviso al usuario ${pago.usuario_id}`, error.message);
      }
    }
    const { data: admins, error: adminsError } = await supabaseAdmin.from('perfiles').select('id').eq('rol', 'admin');
    if (adminsError) throw adminsError;

    for (const admin of admins ?? []) {
      try {
        const { data: cuentaAdmin, error: cuentaAdminError } = await supabaseAdmin.auth.admin.getUserById(admin.id);
        if (cuentaAdminError) throw cuentaAdminError;
        if (!cuentaAdmin?.user?.email) continue;
        const enviado = await enviarAvisoTransferencia(supabaseAdmin, pago.id, `admin:${admin.id}`, {
          to: cuentaAdmin.user.email,
          subject: `Validar transferencia: ${pago.jornadas?.nombre ?? 'Quinielas JR'}`,
          heading: '💳 Transferencia por validar',
          bodyHtml: `<p><b>${escaparHtml(nombreUsuario)}</b> registró <b>${quinielas.length} ${quinielas.length === 1 ? 'quiniela' : 'quinielas'}</b> y subió un comprobante de transferencia.</p>
            <p>Jornada: <b>${escaparHtml(pago.jornadas?.nombre)}</b></p>
            <p>Entradas: ${entradas}</p>
            <p>Monto total: <b>$${Number(pago.monto_total).toFixed(2)}</b></p>
            <p><b>Entra a Administración → Pagos pendientes para revisar el comprobante y validar el pago.</b></p>`,
        });
        if (!enviado) avisosPendientes = true;
      } catch (error) {
        avisosPendientes = true;
        console.error(`notificaciones/pago-transferencia: falló el aviso al admin ${admin.id}`, error.message);
      }
    }

    if (avisosPendientes) {
      return res.status(503).json({ error: 'Quedaron avisos pendientes. Puedes reintentar sin reenviar los que ya se enviaron.' });
    }
    const { error: notificadoError } = await supabaseAdmin.from('pagos_transferencia')
      .update({ notificado_el: new Date().toISOString() })
      .eq('id', pago.id)
      .is('notificado_el', null);
    if (notificadoError) throw notificadoError;
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    const status = error instanceof ErrorHttp ? error.status : 500;
    return res.status(status).json({ error: error.message });
  }
}
