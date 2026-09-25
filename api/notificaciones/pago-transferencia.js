import { requireUser, ErrorHttp } from '../../_lib/auth.js';
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { enviarCorreo, escaparHtml } from '../../_lib/email.js';

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

    const { data: cuenta } = await supabaseAdmin.auth.admin.getUserById(pago.usuario_id);
    const { data: datosUsuario } = await supabaseAdmin.from('perfiles').select('nombre_completo, username').eq('id', pago.usuario_id).maybeSingle();
    const nombreUsuario = datosUsuario?.nombre_completo || datosUsuario?.username || cuenta?.user?.email || 'Un usuario';
    const entradas = quinielas.map((quiniela) => escaparHtml(quiniela.alias ?? 'Entrada')).join(', ');
    if (cuenta?.user?.email) {
      await enviarCorreo({
        to: cuenta.user.email,
        subject: `Quinielas registradas: ${pago.jornadas?.nombre ?? ""}`,
        heading: "¡Tus quinielas quedaron registradas!",
        bodyHtml: `<p>Jornada: <b>${escaparHtml(pago.jornadas?.nombre)}</b></p><p>Registraste <b>${quinielas.length} ${quinielas.length === 1 ? "quiniela" : "quinielas"}</b> mediante transferencia.</p><p>Monto: <b>$${Number(pago.monto_total).toFixed(2)}</b></p><p>Tu pago quedará pendiente hasta que sea validado.</p>`,
      });
    }
    const { data: admins } = await supabaseAdmin.from('perfiles').select('id').eq('rol', 'admin');

    for (const admin of admins ?? []) {
      const { data: cuentaAdmin } = await supabaseAdmin.auth.admin.getUserById(admin.id);
      if (!cuentaAdmin?.user?.email) continue;
      await enviarCorreo({
        to: cuentaAdmin.user.email,
        subject: `Validar transferencia: ${pago.jornadas?.nombre ?? 'Quinielas JR'}`,
        heading: '💳 Transferencia por validar',
        bodyHtml: `<p><b>${escaparHtml(nombreUsuario)}</b> registró <b>${quinielas.length} ${quinielas.length === 1 ? 'quiniela' : 'quinielas'}</b> y subió un comprobante de transferencia.</p>
          <p>Jornada: <b>${escaparHtml(pago.jornadas?.nombre)}</b></p>
          <p>Entradas: ${entradas}</p>
          <p>Monto total: <b>$${Number(pago.monto_total).toFixed(2)}</b></p>
          <p><b>Entra a Administración → Pagos pendientes para revisar el comprobante y validar el pago.</b></p>`,
      });
    }

    await supabaseAdmin.from('pagos_transferencia').update({ notificado_el: new Date().toISOString() }).eq('id', pago.id);
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    const status = error instanceof ErrorHttp ? error.status : 500;
    return res.status(status).json({ error: error.message });
  }
}
