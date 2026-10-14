import { enviarAvisoUnico } from './avisoUnico.js';

export async function avisarAdministradores(supabaseAdmin, claveBase, correo) {
  const { data: admins, error } = await supabaseAdmin.from('perfiles').select('id').eq('rol', 'admin');
  if (error) throw error;
  if (!admins?.length) throw new Error('No hay administradores para notificar');

  const pendientes = [];
  for (const admin of admins ?? []) {
    try {
      const { data: cuenta, error: errorCuenta } = await supabaseAdmin.auth.admin.getUserById(admin.id);
      if (errorCuenta) throw errorCuenta;
      const destinatario = cuenta?.user?.email;
      if (!destinatario) {
        pendientes.push(admin.id);
        continue;
      }
      const enviado = await enviarAvisoUnico(supabaseAdmin, `${claveBase}:${admin.id}`, {
        to: destinatario,
        ...correo,
      });
      if (!enviado) pendientes.push(admin.id);
    } catch (errorAviso) {
      console.error(`avisos-administradores: no se pudo avisar al admin ${admin.id} (${errorAviso?.name ?? 'Error'})`);
      pendientes.push(admin.id);
    }
  }
  return pendientes;
}
