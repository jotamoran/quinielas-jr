import { getSupabaseAdmin } from '../supabaseAdmin.js';

export function normalizarNombreEquipo(nombre) {
  return nombre.trim().toLowerCase();
}

export async function buscarEnCache(termino) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('equipos_cache')
    .select('id_externo, nombre, logo')
    .eq('nombre_normalizado', normalizarNombreEquipo(termino))
    .limit(1);
  if (error) throw error;
  return data ?? [];
}

export async function guardarEnCache(equipos) {
  try {
    const porNombre = new Map();
    for (const e of equipos ?? []) {
      if (!e || typeof e.name !== 'string' || !e.name.trim()) continue;
      const nombre_normalizado = normalizarNombreEquipo(e.name);
      const fila = { nombre: e.name, nombre_normalizado, actualizado_el: new Date().toISOString() };
      if (e.logo) fila.logo = e.logo;
      if (e.id) fila.id_externo = String(e.id);
      porNombre.set(nombre_normalizado, fila); // último gana si el batch trae el mismo equipo dos veces
    }
    if (!porNombre.size) return;

    // Un mismo upsert necesita columnas uniformes entre filas; agrupamos por el set exacto de
    // claves presentes para nunca pisar logo/id_externo existentes con null.
    const grupos = new Map();
    for (const fila of porNombre.values()) {
      const clave = Object.keys(fila).sort().join(',');
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(fila);
    }

    const supabaseAdmin = getSupabaseAdmin();
    for (const grupo of grupos.values()) {
      const { error } = await supabaseAdmin.from('equipos_cache').upsert(grupo, { onConflict: 'nombre_normalizado' });
      if (error) console.error('equiposCache: falló guardarEnCache', error.message);
    }
  } catch (e) {
    console.error('equiposCache: falló guardarEnCache', e.message);
  }
}
