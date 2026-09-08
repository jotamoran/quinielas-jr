import { supabase } from '@/lib/supabase';

async function llamarApi(ruta, opciones = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const respuesta = await fetch(`/api/${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
      ...opciones.headers,
    },
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error ?? 'Error inesperado');
  return datos;
}

export async function buscarFixtures({ leagues, from, to }) {
  const query = new URLSearchParams({ leagues: leagues.join(','), from, to });
  return llamarApi(`fixtures?${query}`);
}

export async function crearJornada({ nombre, costo, premio, fechaCierre, partidosSeleccionados }) {
  if (partidosSeleccionados.length !== 9) throw new Error('La jornada debe tener exactamente 9 partidos');
  const { data: jornada, error } = await supabase
    .from('jornadas')
    .insert({ nombre, costo, premio, fecha_cierre: fechaCierre, estatus: 'borrador' })
    .select()
    .single();
  if (error) throw error;

  const partidos = partidosSeleccionados.map((p) => ({
    jornada_id: jornada.id,
    provider: p.provider ?? 'thesportsdb',
    external_fixture_id: p.provider === 'manual' ? null : String(p.fixture.id),
    external_league_id: p.provider === 'manual' ? null : String(p.league.id),
    liga_nombre: p.league.name,
    equipo_local: p.teams.home.name,
    logo_local: p.teams.home.logo,
    equipo_visitante: p.teams.away.name,
    logo_visitante: p.teams.away.logo,
    fecha_partido: p.fixture.date,
  }));
  const { error: errorPartidos } = await supabase.from('partidos').insert(partidos);
  if (errorPartidos) {
    await supabase.from('jornadas').delete().eq('id', jornada.id);
    throw errorPartidos;
  }

  const { error: errorPublicacion } = await supabase.from('jornadas').update({ estatus: 'activa' }).eq('id', jornada.id);
  if (errorPublicacion) throw errorPublicacion;

  return jornada;
}

export async function listarPagosPendientes() {
  const { data, error } = await supabase
    .from('quinielas')
    .select('id, alias, monto_pagado, metodo_pago, comprobante_url, creado_el, jornadas(nombre), perfiles(nombre_completo)')
    .eq('estatus_pago', 'pendiente')
    .order('creado_el', { ascending: true });
  if (error) throw error;
  return data;
}

export async function aprobarPago(quinielaId) {
  const { error } = await supabase.from('quinielas').update({ estatus_pago: 'aprobado', revisado_el: new Date().toISOString() }).eq('id', quinielaId);
  if (error) throw error;
}

export async function rechazarPago(quinielaId) {
  const { error } = await supabase.from('quinielas').update({ estatus_pago: 'rechazado', revisado_el: new Date().toISOString() }).eq('id', quinielaId);
  if (error) throw error;
}

export async function registrarPagoEfectivo(quinielaId, monto) {
  const { error } = await supabase.from('quinielas').update({
    estatus_pago: 'aprobado',
    metodo_pago: 'efectivo',
    monto_pagado: monto,
    revisado_el: new Date().toISOString(),
  }).eq('id', quinielaId);
  if (error) throw error;
}

export async function obtenerComprobanteUrl(path) {
  const { url } = await llamarApi('comprobante-url', { method: 'POST', body: JSON.stringify({ path }) });
  return url;
}

export async function sincronizarResultados(jornadaId) {
  return llamarApi('sync-results', { method: 'POST', body: JSON.stringify({ jornada_id: jornadaId }) });
}

export async function guardarResultadosManuales(jornadaId, resultados) {
  return llamarApi('manual-results', {
    method: 'POST',
    body: JSON.stringify({ jornada_id: jornadaId, resultados }),
  });
}

export async function cerrarJornada(jornadaId) {
  return llamarApi('cerrar-jornada', { method: 'POST', body: JSON.stringify({ jornada_id: jornadaId }) });
}

export async function editarQuinielaManual(quinielaId, cambios) {
  const { error } = await supabase.from('quinielas').update(cambios).eq('id', quinielaId);
  if (error) throw error;
}
