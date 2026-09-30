import { enviarCorreo } from './email.js';

export async function enviarAvisoTransferencia(supabaseAdmin, pagoId, destinatario, correo) {
  const { error: registroError } = await supabaseAdmin.from('avisos_transferencia').upsert({
    pago_transferencia_id: pagoId,
    destinatario,
  }, { onConflict: 'pago_transferencia_id,destinatario', ignoreDuplicates: true });
  if (registroError) throw registroError;

  const { data: aviso, error: avisoError } = await supabaseAdmin.from('avisos_transferencia')
    .select('enviado_el')
    .eq('pago_transferencia_id', pagoId)
    .eq('destinatario', destinatario)
    .single();
  if (avisoError) throw avisoError;
  if (aviso.enviado_el) return true;

  const reservaId = crypto.randomUUID();
  const vencidaAntesDe = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: reserva, error: reservaError } = await supabaseAdmin.from('avisos_transferencia')
    .update({ reserva_id: reservaId, reservado_el: new Date().toISOString() })
    .eq('pago_transferencia_id', pagoId)
    .eq('destinatario', destinatario)
    .is('enviado_el', null)
    .or(`reservado_el.is.null,reservado_el.lt.${vencidaAntesDe}`)
    .select('reserva_id')
    .maybeSingle();
  if (reservaError) throw reservaError;
  if (!reserva) return false;

  try {
    await enviarCorreo(correo);
  } catch (error) {
    const { error: liberarError } = await supabaseAdmin.from('avisos_transferencia')
      .update({ reserva_id: null, reservado_el: null })
      .eq('pago_transferencia_id', pagoId)
      .eq('destinatario', destinatario)
      .eq('reserva_id', reservaId);
    if (liberarError) throw liberarError;
    throw error;
  }

  const { data: enviado, error: enviadoError } = await supabaseAdmin.from('avisos_transferencia')
    .update({ enviado_el: new Date().toISOString(), reserva_id: null, reservado_el: null })
    .eq('pago_transferencia_id', pagoId)
    .eq('destinatario', destinatario)
    .eq('reserva_id', reservaId)
    .select('enviado_el')
    .maybeSingle();
  if (enviadoError) throw enviadoError;
  return Boolean(enviado);
}
