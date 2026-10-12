import { enviarAvisoUnico } from './avisoUnico.js';

export function enviarAvisoTransferencia(supabaseAdmin, pagoId, destinatario, correo) {
  return enviarAvisoUnico(supabaseAdmin, `transferencia:${pagoId}:${destinatario}`, correo);
}
