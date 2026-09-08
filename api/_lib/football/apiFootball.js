const API_BASE_URL = 'https://v3.football.api-sports.io';
const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN']);

export function normalizeFixture(item) {
  return {
    fixture: { id: String(item.fixture.id), date: item.fixture.date },
    league: { id: String(item.league.id), name: item.league.name },
    teams: {
      home: { name: item.teams.home.name, logo: item.teams.home.logo },
      away: { name: item.teams.away.name, logo: item.teams.away.logo },
    },
  };
}

export function resultFromFixture(item) {
  if (!FINAL_STATUSES.has(item?.fixture?.status?.short)) return null;
  const home = item.goals?.home;
  const away = item.goals?.away;
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home > away) return 'L';
  if (home < away) return 'V';
  return 'E';
}

async function request(path, params) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error('Falta configurar API_FOOTBALL_KEY');
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  const response = await fetch(url, { headers: { 'x-apisports-key': apiKey } });
  const payload = await response.json();
  if (!response.ok) throw new Error(`API-Football respondió ${response.status}`);
  if (payload.errors && Object.keys(payload.errors).length) throw new Error(`API-Football: ${Object.values(payload.errors).join(', ')}`);
  return payload.response ?? [];
}

export async function getFixtures(params) {
  const fixtures = await request('/fixtures', params);
  return fixtures.map(normalizeFixture);
}

export async function getFixturesByIds(ids) {
  if (!ids.length) return [];
  return request('/fixtures', { ids: ids.join('-'), timezone: 'America/Mexico_City' });
}
