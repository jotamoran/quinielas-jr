import { supabase } from '@/lib/supabase';

async function llamarApi(ruta, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const respuesta = await fetch(`/api/${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error ?? 'Error inesperado');
  return datos;
}

export async function obtenerJornadaActiva() {
  const { data, error } = await supabase.from('jornadas').select('*').eq('estatus', 'activa').order('fecha_cierre', { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function obtenerPartidos(jornadaId) {
  const { data, error } = await supabase.from('partidos').select('*').eq('jornada_id', jornadaId).order('fecha_partido');
  if (error) throw error;
  return data;
}

export async function crearQuiniela({ jornadaId, alias, metodoPago, montoPagado, comprobanteUrl }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('quinielas').insert({
    usuario_id: user.id,
    jornada_id: jornadaId,
    alias,
    metodo_pago: metodoPago,
    monto_pagado: montoPagado,
    comprobante_url: comprobanteUrl,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function guardarPredicciones(quinielaId, predicciones) {
  const filas = predicciones.map(({ partidoId, pronostico }) => ({ quiniela_id: quinielaId, partido_id: partidoId, pronostico }));
  const { error } = await supabase.from('predicciones').insert(filas);
  if (error) throw error;
}

export async function subirComprobante(archivo) {
  const { data: { user } } = await supabase.auth.getUser();
  const extension = archivo.name.split('.').pop();
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('comprobantes').upload(path, archivo);
  if (error) throw error;
  return path;
}

export async function notificarRegistro(quinielaId) {
  return llamarApi('notificaciones/registro', { quiniela_id: quinielaId });
}

export async function aplicarCupon(codigo, quinielaId) {
  return llamarApi('cupones/aplicar', { codigo, quiniela_id: quinielaId });
}

export async function obtenerMisQuinielas() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('quinielas')
    .select('id, jornada_id, alias, estatus_pago, metodo_pago, monto_pagado, aciertos, creado_el, jornadas(nombre)')
    .eq('usuario_id', user.id)
    .order('creado_el', { ascending: false });
  if (error) throw error;
  return data;
}

export async function obtenerRanking(jornadaId) {
  const { data, error } = await supabase
    .from('vista_ranking_jornada')
    .select('*')
    .eq('jornada_id', jornadaId)
    .order('posicion');
  if (error) throw error;
  return data;
}
