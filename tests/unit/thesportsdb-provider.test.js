import { describe, expect, it } from 'vitest';
import { normalizeFixture, resultFromEvent, seasonRangeForDate } from '../../api/_lib/football/theSportsDb.js';

const event = (status, home, away) => ({ idEvent: '123', idLeague: '4350', strLeague: 'Liga MX', dateEvent: '2026-09-12', strTime: '19:00:00', strHomeTeam: 'Local', strAwayTeam: 'Visita', strHomeTeamBadge: 'local.png', strAwayTeamBadge: 'visita.png', strStatus: status, intHomeScore: home, intAwayScore: away });

describe('TheSportsDB', () => {
  it('normaliza fixtures y conserva el proveedor', () => {
    expect(normalizeFixture(event('NS', null, null))).toMatchObject({ fixture: { id: '123' }, league: { id: '4350' }, provider: 'thesportsdb' });
  });

  it.each([['FT', '2', '1', 'L'], ['Match Finished', '1', '1', 'E'], ['AET', '0', '1', 'V'], ['NS', null, null, null]])('mapea %s correctamente', (status, home, away, expected) => {
    expect(resultFromEvent(event(status, home, away))).toBe(expected);
  });

  it('calcula el rango de temporada partido por año', () => {
    expect(seasonRangeForDate('2026-09-12')).toBe('2026-2027');
    expect(seasonRangeForDate('2026-03-01')).toBe('2025-2026');
  });
});
