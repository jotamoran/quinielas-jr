import { ErrorHttp } from '../auth.js';

const API_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const FINAL_STATUSES = new Set(['ft', 'aet', 'pen', 'final', 'match finished', 'finished', 'complete']);
const REQUEST_TIMEOUT_MS = 8000;
const MAX_REINTENTOS = 2;
const MAX_CONCURRENT_RESULTS = 4;
const CACHE_CALENDARIO_MS = 60_000;
const cacheCalendario = new Map();

function apiKey() {
  const key = process.env.SPORTSDB_API_KEY?.trim();
  if (!key) throw new Error('Falta configurar SPORTSDB_API_KEY');
  return key;
}

function normalizeFixture(event) {
  const timestamp = event.strTimestamp || `${event.dateEvent}T${event.strTime || '00:00:00'}`;
  return {
    fixture: { id: String(event.idEvent), date: /(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp) ? timestamp : `${timestamp}Z`, round: Number(event.intRound) || null },
    league: { id: String(event.idLeague), name: event.strLeague },
    teams: {
      home: { name: event.strHomeTeam, logo: event.strHomeTeamBadge },
      away: { name: event.strAwayTeam, logo: event.strAwayTeamBadge },
    },
    provider: 'thesportsdb',
  };
}

export async function getNextRound(league) {
  const payload = await request(`eventsnextleague.php?id=${encodeURIComponent(league)}`, true);
  const round = Number(payload.events?.[0]?.intRound);
  return Number.isInteger(round) && round > 0 ? round : null;
}

function marcador(valor) {
  const texto = String(valor ?? '').trim();
  return /^\d+$/.test(texto) ? Number(texto) : null;
}

function resultFromEvent(event) {
  const status = String(event?.strStatus ?? '').trim().toLowerCase();
  const progress = String(event?.strProgress ?? '').trim().toLowerCase();
  if (!FINAL_STATUSES.has(status) && progress !== 'final') return null;
  const home = marcador(event.intHomeScore);
  const away = marcador(event.intAwayScore);
  if (home === null || away === null) return null;
  if (home > away) return 'L';
  if (home < away) return 'V';
  return 'E';
}

async function requestSinCache(endpoint) {
  const key = apiKey();
  let ultimoError;
  for (let intento = 0; intento <= MAX_REINTENTOS; intento += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let noReintentar = false;
    try {
      const response = await fetch(`${API_BASE_URL}/${key}/${endpoint}`, { signal: controller.signal });
      if (response.ok) return await response.json();
      const limiteAlcanzado = response.status === 429;
      ultimoError = new ErrorHttp(
        limiteAlcanzado ? 429 : 502,
        limiteAlcanzado
          ? 'No pudimos cargar los partidos ahora. Espera un minuto y vuelve a intentarlo.'
          : `El servicio de resultados respondió ${response.status}`,
      );
      noReintentar = response.status < 500;
    } catch (error) {
      ultimoError = new ErrorHttp(502, error.name === 'AbortError' ? 'El servicio de resultados tardó demasiado en responder' : 'No se pudo consultar el servicio de resultados');
    } finally { clearTimeout(timeout); }
    if (noReintentar) throw ultimoError;
    if (intento < MAX_REINTENTOS) await new Promise((resolve) => setTimeout(resolve, 250 * (intento + 1)));
  }
  throw ultimoError ?? new ErrorHttp(502, 'No se pudo consultar el servicio de resultados');
}

async function request(endpoint, usarCacheCalendario = false) {
  if (!usarCacheCalendario) return requestSinCache(endpoint);

  const ahora = Date.now();
  for (const [clave, entrada] of cacheCalendario) {
    if (entrada.expira <= ahora) cacheCalendario.delete(clave);
  }
  const existente = cacheCalendario.get(endpoint);
  if (existente) return existente.promesa;

  const entrada = { expira: ahora + CACHE_CALENDARIO_MS, promesa: null };
  entrada.promesa = requestSinCache(endpoint)
    .then((datos) => {
      entrada.expira = Date.now() + CACHE_CALENDARIO_MS;
      return datos;
    })
    .catch((error) => {
      if (cacheCalendario.get(endpoint) === entrada) cacheCalendario.delete(endpoint);
      throw error;
    });
  cacheCalendario.set(endpoint, entrada);
  return entrada.promesa;
}

export function seasonRangeForDate(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  const year = parsed.getUTCFullYear();
  const startYear = parsed.getUTCMonth() < 6 ? year - 1 : year;
  return `${startYear}-${startYear + 1}`;
}

export async function getFixtures({ league, from, to, round, season }) {
  if (round) {
    const payload = await request(`eventsround.php?id=${encodeURIComponent(league)}&r=${encodeURIComponent(round)}&s=${encodeURIComponent(season)}`, true);
    const eventos = (payload.events ?? []).map(normalizeFixture);
    if (eventos.length <= 9) return eventos;
    // El servicio puede agrupar más de un torneo bajo el mismo string de temporada
    // (posible con Apertura+Clausura de Liga MX), una ronda puede traer el
    // doble de partidos. Nos quedamos con los 9 más cercanos a hoy y marcamos el
    // resultado como ambiguo para que el admin verifique la selección.
    const hoy = Date.now();
    const seleccion = eventos
      .sort((a, b) => Math.abs(new Date(a.fixture.date) - hoy) - Math.abs(new Date(b.fixture.date) - hoy))
      .slice(0, 9)
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    return Object.assign(seleccion, { ambiguo: true, totalEncontrados: eventos.length });
  }
  const payload = await request(`eventsnextleague.php?id=${encodeURIComponent(league)}`, true);
  return (payload.events ?? [])
    .filter((event) => (!from || event.dateEvent >= from) && (!to || event.dateEvent <= to))
    .map(normalizeFixture);
}

export async function getFinalResults(ids) {
  apiKey();
  const results = new Map();
  results.fallidos = [];
  for (let inicio = 0; inicio < ids.length; inicio += MAX_CONCURRENT_RESULTS) {
    const lote = ids.slice(inicio, inicio + MAX_CONCURRENT_RESULTS);
    const respuestas = await Promise.allSettled(lote.map(async (id) => {
      const payload = await request(`lookupevent.php?id=${encodeURIComponent(id)}`);
      return [String(id), resultFromEvent(payload.events?.[0])];
    }));
    respuestas.forEach((respuesta, indice) => {
      if (respuesta.status === 'fulfilled') {
        const [id, resultado] = respuesta.value;
        results.set(id, resultado);
      } else {
        results.fallidos.push(String(lote[indice]));
      }
    });
  }
  return results;
}

export { normalizeFixture, resultFromEvent };
