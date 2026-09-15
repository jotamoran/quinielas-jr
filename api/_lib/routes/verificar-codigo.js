import { ErrorHttp } from '../auth.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    const { email, codigo } = req.body ?? {};
    if (typeof email !== 'string' || !email.trim() || !/^\d{6}$/.test(String(codigo ?? ''))) {
      return res.status(400).json({ error: 'El código debe tener exactamente 6 dígitos.' });
    }
    if (!process.env.SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) throw new ErrorHttp(500, 'Error de configuración del servidor');
    const respuesta = await fetch(`${process.env.SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), token: String(codigo), type: 'signup' }),
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) return res.status(400).json({ error: datos.msg || datos.message || 'El código no es válido o ya expiró.' });
    return res.status(200).json({ access_token: datos.access_token, refresh_token: datos.refresh_token });
  } catch (error) {
    return res.status(error instanceof ErrorHttp ? error.status : 500).json({ error: error.message || 'No se pudo verificar el código' });
  }
}
