const API_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const FINAL_STATUSES = new Set(['ft', 'aet', 'pen', 'match finished', 'finished', 'complete']);
const REQUEST_TIMEOUT_MS = 8000;
const MAX_REINTENTOS = 2;
const MAX_CONCURRENT_RESULTS = 4;

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
  const payload = await request(`eventsnextleague.php?id=${encodeURIComponent(league)}`);
  const round = Number(payload.events?.[0]?.intRound);
  return Number.isInteger(round) && round > 0 ? round : null;
}

function resultFromEvent(event) {
  const status = String(event?.strStatus ?? '').trim().toLowerCase();
  if (!FINAL_STATUSES.has(status)) return null;
  const home = Number(event.intHomeScore);
  const away = Number(event.intAwayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home > away) return 'L';
  if (home < away) return 'V';
  return 'E';
}

async function request(endpoint) {
  const key = apiKey();
  let ultimoError;
  for (let intento = 0; intento <= MAX_REINTENTOS; intento += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE_URL}/${key}/${endpoint}`, { signal: controller.signal });
      if (response.ok) return await response.json();
      ultimoError = new Error(`El servicio de resultados respondió ${response.status}`);
      if (response.status < 500 && response.status !== 429) throw ultimoError;
    } catch (error) {
      ultimoError = error.name === 'AbortError' ? new Error('El servicio de resultados tardó demasiado en responder') : error;
    } finally { clearTimeout(timeout); }
    if (intento < MAX_REINTENTOS) await new Promise((resolve) => setTimeout(resolve, 250 * (intento + 1)));
  }
  throw ultimoError ?? new Error('No se pudo consultar el servicio de resultados');
}

export function seasonRangeForDate(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  const year = parsed.getUTCFullYear();
  const startYear = parsed.getUTCMonth() < 6 ? year - 1 : year;
  return `${startYear}-${startYear + 1}`;
}

export async function getFixtures({ league, from, to, round, season }) {
  if (round) {
    const payload = await request(`eventsround.php?id=${encodeURIComponent(league)}&r=${encodeURIComponent(round)}&s=${encodeURIComponent(season)}`);
    const eventos = (payload.events ?? []).map(normalizeFixture);
    if (eventos.length <= 9) return eventos;
    // El servicio puede agrupar más de un torneo bajo el mismo string de temporada
    // (posible con Apertura+Clausura de Liga MX), una ronda puede traer el
    // doble de partidos. Nos quedamos con los 9 más cercanos a hoy — no
    // verificado en vivo todavía porque el Clausura no ha empezado.
    const hoy = Date.now();
    return eventos
      .sort((a, b) => Math.abs(new Date(a.fixture.date) - hoy) - Math.abs(new Date(b.fixture.date) - hoy))
      .slice(0, 9)
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
  }
  const payload = await request(`eventsnextleague.php?id=${encodeURIComponent(league)}`);
  return (payload.events ?? [])
    .filter((event) => (!from || event.dateEvent >= from) && (!to || event.dateEvent <= to))
    .map(normalizeFixture);
}

export async function getFinalResults(ids) {
  apiKey();
  const results = new Map();
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
        results.set(String(lote[indice]), null);
      }
    });
  }
  return results;
}

export { normalizeFixture, resultFromEvent };
