import { describe, it, expect } from 'vitest';
import { calcularGanadoresYPeor } from '../../api/_lib/premios.js';

describe('calcularGanadoresYPeor', () => {
  it('un solo ganador y un solo peor (sin empates) reciben premio y cupón respectivamente', () => {
    const entradas = [
      { quinielaId: 'q1', usuarioId: 'u1', aciertos: 8 },
      { quinielaId: 'q2', usuarioId: 'u2', aciertos: 5 },
      { quinielaId: 'q3', usuarioId: 'u3', aciertos: 2 },
    ];
    const resultado = calcularGanadoresYPeor(entradas, 300);
    expect(resultado.ganadores).toEqual([{ quinielaId: 'q1', usuarioId: 'u1', montoPremio: 300 }]);
    expect(resultado.peor).toEqual({ quinielaId: 'q3', usuarioId: 'u3' });
  });

  it('empate en primer lugar reparte el premio en partes iguales', () => {
    const entradas = [
      { quinielaId: 'q1', usuarioId: 'u1', aciertos: 7 },
      { quinielaId: 'q2', usuarioId: 'u2', aciertos: 7 },
      { quinielaId: 'q3', usuarioId: 'u3', aciertos: 3 },
    ];
    const resultado = calcularGanadoresYPeor(entradas, 300);
    expect(resultado.ganadores).toEqual([
      { quinielaId: 'q1', usuarioId: 'u1', montoPremio: 150 },
      { quinielaId: 'q2', usuarioId: 'u2', montoPremio: 150 },
    ]);
    expect(resultado.peor).toEqual({ quinielaId: 'q3', usuarioId: 'u3' });
  });

  it('empate en el último lugar no genera cupón (peor debe ser null)', () => {
    const entradas = [
      { quinielaId: 'q1', usuarioId: 'u1', aciertos: 8 },
      { quinielaId: 'q2', usuarioId: 'u2', aciertos: 2 },
      { quinielaId: 'q3', usuarioId: 'u3', aciertos: 2 },
    ];
    const resultado = calcularGanadoresYPeor(entradas, 300);
    expect(resultado.peor).toBeNull();
  });

  it('sin premio definido, los ganadores no llevan monto', () => {
    const entradas = [
      { quinielaId: 'q1', usuarioId: 'u1', aciertos: 5 },
      { quinielaId: 'q2', usuarioId: 'u2', aciertos: 1 },
    ];
    const resultado = calcularGanadoresYPeor(entradas, null);
    expect(resultado.ganadores).toEqual([{ quinielaId: 'q1', usuarioId: 'u1', montoPremio: 0 }]);
  });
});
