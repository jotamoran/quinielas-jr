export function calcularRecaudacion(entradas) {
  return entradas.reduce((resumen, entrada) => {
    if (entrada.estatus_pago !== 'aprobado') return resumen;
    if (entrada.metodo_pago === 'cupon') {
      resumen.cupones += 1;
    } else if (['efectivo', 'transferencia'].includes(entrada.metodo_pago)) {
      const monto = Number(entrada.monto_pagado);
      if (Number.isFinite(monto) && monto > 0) resumen.total += monto;
    }
    return resumen;
  }, { total: 0, cupones: 0 });
}
