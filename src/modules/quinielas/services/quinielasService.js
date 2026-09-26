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

export async function obtenerJornadaActiva(jornadaId = null, { soloAbierta = false } = {}) {
  let consulta = supabase.from('jornadas').select('*').eq('estatus', 'activa');
  if (jornadaId) consulta = consulta.eq('id', jornadaId);
  else {
    if (soloAbierta) consulta = consulta.gt('fecha_cierre', new Date().toISOString());
    consulta = consulta.order('fecha_cierre', { ascending: true }).limit(1);
  }
  const { data, error } = await consulta.maybeSingle();
  if (error) throw error;
  return data;
}

export async function obtenerPartidos(jornadaId) {
  const { data, error } = await supabase.from('partidos').select('*').eq('jornada_id', jornadaId).order('fecha_partido');
  if (error) throw error;
  return data;
}

export async function subirComprobante(archivo) {
  const { data: { user } } = await supabase.auth.getUser();
  const extensiones = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
  const extension = extensiones[archivo?.type];
  if (!user || !extension || archivo.size > 8 * 1024 * 1024) throw new Error('El comprobante debe ser una imagen o PDF de máximo 8 MB.');
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('comprobantes').upload(path, archivo, { contentType: archivo.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function eliminarComprobante(path) {
  if (!path) return;
  const { error } = await supabase.storage.from('comprobantes').remove([path]);
  if (error) throw error;
}

export async function notificarRegistro({ quinielaId = null, pagoTransferenciaId = null }) {
  return llamarApi('notificaciones/registro', {
    quiniela_id: quinielaId,
    pago_transferencia_id: pagoTransferenciaId,
  });
}

export async function notificarPagoTransferencia(pagoTransferenciaId) {
  return llamarApi('notificaciones/pago-transferencia', { pago_transferencia_id: pagoTransferenciaId });
}

export async function obtenerMisQuinielas() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('quinielas')
    .select('id, jornada_id, alias, estatus_pago, metodo_pago, monto_pagado, aciertos, creado_el, jornadas(nombre, fecha_cierre, estatus)')
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

export async function obtenerRankingPublico(jornadaId) {
  const { data, error } = await supabase
    .from('vista_ranking_publica')
    .select('*')
    .eq('jornada_id', jornadaId)
    .order('posicion');
  if (error) throw error;
  return data;
}

export async function obtenerPronosticosDeQuiniela(quinielaId) {
  const { data, error } = await supabase
    .from('predicciones')
    .select('partido_id, pronostico, partidos(equipo_local, equipo_visitante, logo_local, logo_visitante, resultado_oficial, estado, puntos_local, puntos_visitante, cancelado, fecha_partido)')
    .eq('quiniela_id', quinielaId);
  if (error) throw error;
  return (data ?? [])
    .slice()
    .sort((a, b) => new Date(a.partidos?.fecha_partido ?? 0) - new Date(b.partidos?.fecha_partido ?? 0))
    .map((item) => ({
      partido_id: item.partido_id,
      equipo_local: item.partidos?.equipo_local,
      equipo_visitante: item.partidos?.equipo_visitante,
      logo_local: item.partidos?.logo_local,
      logo_visitante: item.partidos?.logo_visitante,
      pronostico: item.pronostico,
      resultado_oficial: item.partidos?.resultado_oficial,
      estado: item.partidos?.estado,
      puntos_local: item.partidos?.puntos_local,
      puntos_visitante: item.partidos?.puntos_visitante,
      cancelado: item.partidos?.cancelado ?? false,
      fecha_partido: item.partidos?.fecha_partido,
    }));
}

export async function obtenerQuinielaParaEditar(quinielaId) {
  const { data, error } = await supabase.from('quinielas').select('id, jornada_id, alias, jornadas(id, nombre, fecha_cierre, estatus), predicciones(partido_id, pronostico, partidos(id, equipo_local, equipo_visitante, logo_local, logo_visitante, fecha_partido, estado, puntos_local, puntos_visitante, cancelado))').eq('id', quinielaId).single();
  if (error) throw error;
  return data;
}

export async function registrarQuiniela({ jornadaId, alias, metodoPago, montoPagado, comprobanteUrl, predicciones, codigoCupon = null }) {
  const { data, error } = await supabase.rpc('registrar_quiniela_atomica', {
    p_jornada_id: jornadaId,
    p_alias: alias,
    p_metodo_pago: metodoPago,
    p_monto_pagado: montoPagado,
    p_comprobante_url: comprobanteUrl,
    p_predicciones: predicciones.map(({ partidoId, pronostico }) => ({ partido_id: partidoId, pronostico })),
    p_codigo_cupon: codigoCupon,
  });
  if (error) throw error;
  return data;
}

export async function registrarQuinielasTransferencia({ jornadaId, entradas, comprobanteUrl }) {
  const { data, error } = await supabase.rpc('registrar_quinielas_transferencia_atomica', {
    p_jornada_id: jornadaId,
    p_quinielas: entradas.map(({ alias, predicciones }) => ({
      alias,
      predicciones: predicciones.map(({ partidoId, pronostico }) => ({ partido_id: partidoId, pronostico })),
    })),
    p_comprobante_url: comprobanteUrl,
  });
  if (error) throw error;
  return data;
}

export async function actualizarPredicciones(quinielaId, predicciones) {
  const { error } = await supabase.rpc('actualizar_predicciones_atomica', {
    p_quiniela_id: quinielaId,
    p_predicciones: predicciones.map(({ partidoId, pronostico }) => ({ partido_id: partidoId, pronostico })),
  });
  if (error) throw error;
}

export async function obtenerDatosBancarios() {
  const { data, error } = await supabase.from('datos_bancarios').select('banco, clabe, titular').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data;
}
