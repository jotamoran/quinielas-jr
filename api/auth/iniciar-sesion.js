import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

const CONTIENE_ARROBA = /@/;
const MENSAJE_GENERICO = 'Correo/usuario o contraseña incorrectos.';
const MENSAJES_POR_CODIGO = {
  email_not_confirmed: 'Debes confirmar tu correo antes de iniciar sesión.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  user_banned: 'Esta cuenta está bloqueada. Contacta al administrador.',
};

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    const { entrada, password } = req.body ?? {};
    if (typeof entrada !== 'string' || !entrada.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Completa usuario/correo y contraseña' });
    }

    if (!process.env.SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
      console.error('iniciar-sesion: falta SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno');
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let correo = entrada.trim();
    if (!CONTIENE_ARROBA.test(correo)) {
      const username = correo.toLowerCase();
      const { data: perfil, error: errorPerfil } = await supabaseAdmin.from('perfiles').select('id').eq('username', username).maybeSingle();
      if (errorPerfil) console.error('iniciar-sesion: falló la búsqueda de username', errorPerfil.message);
      if (perfil) {
        const { data: cuenta, error: errorCuenta } = await supabaseAdmin.auth.admin.getUserById(perfil.id);
        if (errorCuenta) console.error('iniciar-sesion: falló getUserById', errorCuenta.message);
        correo = cuenta?.user?.email ?? `usuario-inexistente-${username}@quinielasjr.invalid`;
      } else {
        correo = `usuario-inexistente-${username}@quinielasjr.invalid`;
      }
    }

    const respuesta = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: correo, password }),
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) {
      const mensaje = MENSAJES_POR_CODIGO[datos.error_code] ?? MENSAJE_GENERICO;
      return res.status(400).json({ error: mensaje });
    }

    return res.status(200).json({ access_token: datos.access_token, refresh_token: datos.refresh_token });
  } catch (error) {
    console.error('iniciar-sesion: error inesperado', error.message);
    return res.status(500).json({ error: 'Error inesperado, intenta de nuevo' });
  }
}
