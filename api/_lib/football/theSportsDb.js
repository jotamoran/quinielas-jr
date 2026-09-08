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

export async function getFixtures({ league, from, to }) {
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
