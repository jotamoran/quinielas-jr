const API_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN', 'Match Finished']);

function apiKey() {
  return process.env.SPORTSDB_API_KEY || '123';
}

function normalizeFixture(event) {
  const timestamp = event.strTimestamp || `${event.dateEvent}T${event.strTime || '00:00:00'}`;
  return {
    fixture: { id: String(event.idEvent), date: /(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp) ? timestamp : `${timestamp}Z` },
    league: { id: String(event.idLeague), name: event.strLeague },
    teams: {
      home: { name: event.strHomeTeam, logo: event.strHomeTeamBadge },
      away: { name: event.strAwayTeam, logo: event.strAwayTeamBadge },
    },
    provider: 'thesportsdb',
  };
}

function resultFromEvent(event) {
  if (!FINAL_STATUSES.has(event?.strStatus)) return null;
  const home = Number(event.intHomeScore);
  const away = Number(event.intAwayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home > away) return 'L';
  if (home < away) return 'V';
  return 'E';
}

async function request(endpoint) {
  const response = await fetch(`${API_BASE_URL}/${apiKey()}/${endpoint}`);
  if (!response.ok) throw new Error(`TheSportsDB respondió ${response.status}`);
  return response.json();
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
    // Si TheSportsDB agrupa más de un torneo bajo el mismo string de temporada
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
  const results = new Map();
  for (const id of ids) {
    const payload = await request(`lookupevent.php?id=${encodeURIComponent(id)}`);
    const event = payload.events?.[0];
    results.set(String(id), resultFromEvent(event));
  }
  return results;
}

export { normalizeFixture, resultFromEvent };
