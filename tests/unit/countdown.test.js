import { describe, it, expect } from 'vitest';
import { calcularTiempoRestante, estaBloqueado } from '@/modules/quinielas/utils/countdown';

describe('calcularTiempoRestante', () => {
  it('calcula días, horas, minutos y segundos restantes', () => {
    const ahora = new Date('2026-09-07T00:00:00Z');
    const cierre = new Date('2026-09-08T01:02:03Z');
    const r = calcularTiempoRestante(cierre, ahora);
    expect(r).toEqual({ dias: 1, horas: 1, minutos: 2, segundos: 3, vencido: false });
  });

  it('marca vencido cuando ya pasó la fecha de cierre', () => {
    const ahora = new Date('2026-09-08T00:00:01Z');
    const cierre = new Date('2026-09-08T00:00:00Z');
    const r = calcularTiempoRestante(cierre, ahora);
    expect(r.vencido).toBe(true);
    expect(r).toMatchObject({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
  });
});

describe('estaBloqueado', () => {
  it('es false antes del cierre y true después', () => {
    const cierre = new Date('2026-09-08T00:00:00Z');
    expect(estaBloqueado(cierre, new Date('2026-09-07T23:59:59Z'))).toBe(false);
    expect(estaBloqueado(cierre, new Date('2026-09-08T00:00:01Z'))).toBe(true);
  });
});
