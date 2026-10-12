const API_DEPORTES = 'https://www.thesportsdb.com/api/v1/json';
const TIMEOUT_MS = 8000;
const MAX_REINTENTOS = 2;
const CONCURRENCIA = 4;

const ESTADOS_FINALES = new Set(['ft', 'aet', 'pen', 'final', 'match finished', 'finished', 'complete']);
const ESTADOS_EN_VIVO = new Set(['1h', '2h', 'ht', 'et', 'bt', 'p', 'live', 'in progress', 'extra time', 'half time']);
const ESTADOS_PENDIENTES = new Set(['not started', 'scheduled', 'postponed', 'canceled', 'cancelled', 'abandoned', 'suspended']);

// El proveedor limita las consultas (429): se deja el partido para el siguiente ciclo.
class LimiteExcedido extends Error {}

export function numero(valor) {
  const texto = String(valor ?? '').trim();
  return /^\d+$/.test(texto) ? Number(texto) : null;
}

export function estadoEvento(evento) {
  const status = String(evento.strStatus ?? '').trim().toLowerCase();
  const progreso = String(evento.strProgress ?? '').trim().toLowerCase();
  if (ESTADOS_FINALES.has(status) || progreso === 'final') return 'finalizado';
  if (ESTADOS_PENDIENTES.has(status) || ESTADOS_PENDIENTES.has(progreso)) return 'pendiente';
  if (ESTADOS_EN_VIVO.has(status) || !['', '-', 'not started'].includes(progreso)) return 'en_vivo';
  return 'pendiente';
}

export function resultadoEvento(evento) {
  const local = numero(evento.intHomeScore);
  const visita = numero(evento.intAwayScore);
  if (local === null || visita === null) return null;
  if (local > visita) return 'L';
  if (local < visita) return 'V';
  return 'E';
}

async function conReintentos(solicitud, mensaje) {
  let ultimoError;
  for (let intento = 0; intento <= MAX_REINTENTOS; intento += 1) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);
    try {
      const respuesta = await solicitud(controlador.signal);
      if (respuesta.status === 429) throw new LimiteExcedido(mensaje);
      if (respuesta.ok) {
        const texto = await respuesta.text();
        return texto ? JSON.parse(texto) : [];
      }
      ultimoError = new Error(`${mensaje} (HTTP ${respuesta.status})`);
      if (respuesta.status < 500 && respuesta.status !== 408) throw ultimoError;
    } catch (error) {
      if (error instanceof LimiteExcedido || error === ultimoError) throw error;
      ultimoError = new Error(mensaje);
    } finally {
      clearTimeout(temporizador);
    }
    if (intento < MAX_REINTENTOS) await new Promise((resolver) => setTimeout(resolver, 1500 * 2 ** intento));
  }
  throw ultimoError ?? new Error(mensaje);
}

function clienteSupabase(env) {
  const base = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
  const cabeceras = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  return (metodo, tabla, { params, cuerpo } = {}) => {
    const url = `${base}/${tabla}?${new URLSearchParams(params)}`;
    return conReintentos((signal) => fetch(url, {
      method: metodo,
      signal,
      headers: { ...cabeceras, Prefer: metodo === 'PATCH' ? 'return=representation' : 'return=minimal' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    }), 'No se pudo consultar la base de datos');
  };
}

async function obtenerEvento(env, idExterno) {
  const url = `${API_DEPORTES}/${env.SPORTSDB_API_KEY}/lookupevent.php?id=${encodeURIComponent(idExterno)}`;
  const payload = await conReintentos((signal) => fetch(url, { signal }), 'No se pudo consultar el servicio externo');
  return payload.events?.[0] ?? null;
}

function prepararActualizacion(env, partido) {
  return obtenerEvento(env, partido.external_fixture_id).then((evento) => {
    if (!evento) return null;
    const estado = estadoEvento(evento);
    const local = numero(evento.intHomeScore);
    const visita = numero(evento.intAwayScore);
    if (estado === 'pendiente' || local === null || visita === null) return null;
    const cambios = {
      estado,
      puntos_local: local,
      puntos_visitante: visita,
      resultado_oficial: estado === 'finalizado' ? resultadoEvento(evento) : null,
    };
    const hayCambio = Object.keys(cambios).some((campo) => partido[campo] !== cambios[campo]);
    return hayCambio ? cambios : null;
  });
}

async function sincronizarJornada(env, supabase, jornada, ahora) {
  const partidos = await supabase('GET', 'partidos', {
    params: {
      select: 'id,external_fixture_id,provider,fecha_partido,cancelado,resultado_oficial,estado,puntos_local,puntos_visitante,actualizado_el',
      jornada_id: `eq.${jornada.id}`,
      provider: 'eq.thesportsdb',
      cancelado: 'eq.false',
      external_fixture_id: 'not.is.null',
    },
  });
  const pendientes = (partidos ?? []).filter((partido) => !partido.resultado_oficial && new Date(partido.fecha_partido) <= ahora);

  const resumen = { consultados: pendientes.length, actualizados: 0, finalizados: 0, errores: 0, limite: false };
  for (let inicio = 0; inicio < pendientes.length && !resumen.limite; inicio += CONCURRENCIA) {
    const lote = pendientes.slice(inicio, inicio + CONCURRENCIA);
    const respuestas = await Promise.allSettled(lote.map((partido) => prepararActualizacion(env, partido)));
    for (const [indice, respuesta] of respuestas.entries()) {
      const partido = lote[indice];
      if (respuesta.status === 'rejected') {
        if (respuesta.reason instanceof LimiteExcedido) resumen.limite = true;
        else resumen.errores += 1;
        continue;
      }
      const cambios = respuesta.value;
      if (!cambios) continue;
      try {
        // Las condiciones del PATCH evitan pisar un cambio administrativo hecho mientras se consultaba.
        const filtros = { id: `eq.${partido.id}`, jornada_id: `eq.${jornada.id}`, cancelado: 'eq.false', resultado_oficial: 'is.null' };
        for (const campo of ['actualizado_el', 'estado', 'puntos_local', 'puntos_visitante', 'provider', 'external_fixture_id', 'fecha_partido']) {
          filtros[campo] = partido[campo] === null || partido[campo] === undefined ? 'is.null' : `eq.${partido[campo]}`;
        }
        const filas = await supabase('PATCH', 'partidos', { params: filtros, cuerpo: { ...cambios, actualizado_el: new Date().toISOString() } });
        if (!filas?.length) continue;
        resumen.actualizados += 1;
        if (cambios.resultado_oficial) resumen.finalizados += 1;
      } catch {
        resumen.errores += 1;
      }
    }
  }
  return resumen;
}

export async function sincronizarMarcadores(env, ahora = new Date()) {
  for (const clave of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SPORTSDB_API_KEY']) {
    if (!env[clave]) throw new Error(`Falta configurar ${clave}`);
  }
  const supabase = clienteSupabase(env);
  const jornadas = await supabase('GET', 'jornadas', { params: { select: 'id,estatus', estatus: 'in.(activa,cerrada)' } });
  const total = { jornadas: jornadas.length, consultados: 0, actualizados: 0, finalizados: 0, errores: 0, limite: false };
  for (const jornada of jornadas) {
    try {
      const resumen = await sincronizarJornada(env, supabase, jornada, ahora);
      total.consultados += resumen.consultados;
      total.actualizados += resumen.actualizados;
      total.finalizados += resumen.finalizados;
      total.errores += resumen.errores;
      total.limite ||= resumen.limite;
    } catch (error) {
      total.errores += 1;
      console.error(`marcadores: no se pudo actualizar la jornada ${jornada.id}: ${error.message}`);
    }
  }
  console.log(`marcadores: ${JSON.stringify(total)}`);
  return total;
}
