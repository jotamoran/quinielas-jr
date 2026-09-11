import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

const CONTIENE_ARROBA = /@/;
const MENSAJE_GENERICO = 'Correo/usuario o contraseña incorrectos.';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    const { entrada, password } = req.body ?? {};
    if (!entrada?.trim() || !password) return res.status(400).json({ error: 'Completa usuario/correo y contraseña' });

    const supabaseAdmin = getSupabaseAdmin();
    let correo = entrada.trim();
    if (!CONTIENE_ARROBA.test(correo)) {
      const username = correo.toLowerCase();
      const { data: perfil } = await supabaseAdmin.from('perfiles').select('id').eq('username', username).maybeSingle();
      if (!perfil) return res.status(400).json({ error: MENSAJE_GENERICO });
      const { data: cuenta, error: errorCuenta } = await supabaseAdmin.auth.admin.getUserById(perfil.id);
      if (errorCuenta || !cuenta?.user?.email) return res.status(400).json({ error: MENSAJE_GENERICO });
      correo = cuenta.user.email;
    }

    const respuesta = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: correo, password }),
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) return res.status(400).json({ error: MENSAJE_GENERICO });

    return res.status(200).json({ access_token: datos.access_token, refresh_token: datos.refresh_token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
