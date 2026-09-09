import { getSupabaseAdmin } from '../supabaseAdmin.js';

export function normalizarNombreEquipo(nombre) {
  return nombre.trim().toLowerCase();
}

export async function buscarEnCache(termino) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('equipos_cache')
    .select('id_externo, nombre, logo')
    .ilike('nombre_normalizado', `%${normalizarNombreEquipo(termino)}%`)
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export async function guardarEnCache(equipos) {
  const supabaseAdmin = getSupabaseAdmin();
  const filas = equipos
    .filter((e) => e?.name)
    .map((e) => ({
      nombre: e.name,
      nombre_normalizado: normalizarNombreEquipo(e.name),
      logo: e.logo ?? null,
      id_externo: e.id ? String(e.id) : null,
    }));
  if (!filas.length) return;
  try {
    await supabaseAdmin.from('equipos_cache').upsert(filas, { onConflict: 'nombre_normalizado' });
  } catch (e) {
    console.error('equiposCache: falló guardarEnCache', e.message);
  }
}
