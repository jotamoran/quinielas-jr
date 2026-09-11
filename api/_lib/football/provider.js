import { getFixtures, getFinalResults, seasonRangeForDate } from './theSportsDb.js';

export const FOOTBALL_PROVIDER = 'thesportsdb';

export function seasonForDate(date, mode = 'calendar') {
  const parsed = new Date(`${date}T12:00:00Z`);
  const year = parsed.getUTCFullYear();
  return mode === 'european' && parsed.getUTCMonth() < 6 ? year - 1 : year;
}

export const findFixtures = getFixtures;
export const findFinalResults = getFinalResults;
export { seasonRangeForDate };
