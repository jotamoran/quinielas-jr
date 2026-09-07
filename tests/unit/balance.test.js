import { describe, it, expect } from 'vitest';
import { calcularResumenBalance } from '@/modules/quinielas/utils/balance';

describe('calcularResumenBalance', () => {
  it('solo cuenta quinielas aprobadas para el gasto y las estadísticas', () => {
    const quinielas = [
      { jornada_id: 'j1', estatus_pago: 'aprobado', monto_pagado: 50, aciertos: 6, posicion: 2 },
      { jornada_id: 'j1', estatus_pago: 'aprobado', monto_pagado: 50, aciertos: 4, posicion: 5 },
      { jornada_id: 'j2', estatus_pago: 'aprobado', monto_pagado: 100, aciertos: 8, posicion: 1 },
      { jornada_id: 'j3', estatus_pago: 'rechazado', monto_pagado: 50, aciertos: 0, posicion: null },
      { jornada_id: 'j4', estatus_pago: 'pendiente', monto_pagado: null, aciertos: 0, posicion: null },
    ];

    expect(calcularResumenBalance(quinielas)).toEqual({
      totalGastado: 200,
      jornadasJugadas: 3,
      aciertosTotales: 18,
      aciertosPromedio: 6,
      mejorPosicion: 1,
    });
  });

  it('devuelve ceros y mejorPosicion null si no hay quinielas aprobadas', () => {
    expect(calcularResumenBalance([])).toEqual({
      totalGastado: 0,
      jornadasJugadas: 0,
      aciertosTotales: 0,
      aciertosPromedio: 0,
      mejorPosicion: null,
    });
  });
});
