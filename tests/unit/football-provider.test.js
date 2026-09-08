import { describe, expect, it } from 'vitest';
import { normalizeFixture, resultFromFixture } from '../../api/_lib/football/apiFootball.js';
import { seasonForDate } from '../../api/_lib/football/provider.js';

const fixture = (status, home, away) => ({ fixture: { id: 10, date: '2026-09-12T19:00:00-06:00', status: { short: status } }, league: { id: 262, name: 'Liga MX' }, teams: { home: { name: 'Local', logo: 'local.png' }, away: { name: 'Visita', logo: 'visita.png' } }, goals: { home, away } });

describe('API-Football', () => {
  it('normaliza sin filtrar detalles del proveedor', () => {
    expect(normalizeFixture(fixture('NS', null, null))).toEqual({ fixture: { id: '10', date: '2026-09-12T19:00:00-06:00' }, league: { id: '262', name: 'Liga MX' }, teams: { home: { name: 'Local', logo: 'local.png' }, away: { name: 'Visita', logo: 'visita.png' } } });
  });

  it.each([['FT', 2, 1, 'L'], ['AET', 1, 1, 'E'], ['PEN', 0, 1, 'V'], ['NS', null, null, null]])('mapea %s correctamente', (status, home, away, expected) => {
    expect(resultFromFixture(fixture(status, home, away))).toBe(expected);
  });

  it('calcula temporadas europeas y de calendario', () => {
    expect(seasonForDate('2026-03-01', 'european')).toBe(2025);
    expect(seasonForDate('2026-09-01', 'european')).toBe(2026);
    expect(seasonForDate('2026-03-01')).toBe(2026);
  });
});
