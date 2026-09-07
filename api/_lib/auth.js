import { getSupabaseAdmin } from './supabaseAdmin.js';

export class ErrorHttp extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(req) {
  const encabezado = req.headers['authorization'] || '';
  const token = encabezado.replace('Bearer ', '');
  if (!token) throw new ErrorHttp(401, 'Falta el token de autenticación');

  const supabaseAdmin = getSupabaseAdmin();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new ErrorHttp(401, 'Token inválido o expirado');

  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('id, nombre_completo, rol')
    .eq('id', user.id)
    .single();

  return { user, perfil };
}

export async function requireAdmin(req) {
  const { user, perfil } = await requireUser(req);
  if (perfil?.rol !== 'admin') throw new ErrorHttp(403, 'Requiere rol de administrador');
  return { user, perfil };
}
