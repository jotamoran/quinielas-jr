import { enviarCorreo } from './email.js';

const MINUTOS_RESERVA = 15;

// Envía el correo una sola vez por clave: reserva el aviso, envía y marca el éxito.
// Devuelve true si el aviso ya quedó enviado y false si otra solicitud lo tiene reservado.
export async function enviarAvisoUnico(supabaseAdmin, clave, correo) {
  const { error: registroError } = await supabaseAdmin.from('avisos_correo').upsert({ clave }, { onConflict: 'clave', ignoreDuplicates: true });
  if (registroError) throw registroError;

  const { data: aviso, error: avisoError } = await supabaseAdmin.from('avisos_correo')
    .select('enviado_el')
    .eq('clave', clave)
    .single();
  if (avisoError) throw avisoError;
  if (aviso.enviado_el) return true;

  const reservaId = crypto.randomUUID();
  const vencidaAntesDe = new Date(Date.now() - MINUTOS_RESERVA * 60 * 1000).toISOString();
  const { data: reserva, error: reservaError } = await supabaseAdmin.from('avisos_correo')
    .update({ reserva_id: reservaId, reservado_el: new Date().toISOString() })
    .eq('clave', clave)
    .is('enviado_el', null)
    .or(`reservado_el.is.null,reservado_el.lt.${vencidaAntesDe}`)
    .select('reserva_id')
    .maybeSingle();
  if (reservaError) throw reservaError;
  if (!reserva) return false;

  try {
    await enviarCorreo(correo);
  } catch (error) {
    const { error: liberarError } = await supabaseAdmin.from('avisos_correo')
      .update({ reserva_id: null, reservado_el: null })
      .eq('clave', clave)
      .eq('reserva_id', reservaId);
    if (liberarError) throw liberarError;
    throw error;
  }

  const { data: enviado, error: enviadoError } = await supabaseAdmin.from('avisos_correo')
    .update({ enviado_el: new Date().toISOString(), reserva_id: null, reservado_el: null })
    .eq('clave', clave)
    .eq('reserva_id', reservaId)
    .select('enviado_el')
    .maybeSingle();
  if (enviadoError) throw enviadoError;
  return Boolean(enviado);
}
