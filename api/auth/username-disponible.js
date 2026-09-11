import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
    const username = String(req.query.username ?? '').trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) return res.status(200).json({ disponible: false });

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.from('perfiles').select('id').eq('username', username).maybeSingle();
    if (error) throw error;
    return res.status(200).json({ disponible: !data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
