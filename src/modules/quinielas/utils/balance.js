export function calcularResumenBalance(quinielas) {
  const aprobadas = quinielas.filter((q) => q.estatus_pago === 'aprobado');

  if (aprobadas.length === 0) {
    return { totalGastado: 0, jornadasJugadas: 0, aciertosTotales: 0, aciertosPromedio: 0, mejorPosicion: null };
  }

  const totalGastado = aprobadas.reduce((suma, q) => suma + Number(q.monto_pagado ?? 0), 0);
  const aciertosTotales = aprobadas.reduce((suma, q) => suma + Number(q.aciertos ?? 0), 0);
  const posiciones = aprobadas.map((q) => q.posicion).filter((p) => p != null);

  return {
    totalGastado,
    jornadasJugadas: aprobadas.length,
    aciertosTotales,
    aciertosPromedio: Math.round((aciertosTotales / aprobadas.length) * 100) / 100,
    mejorPosicion: posiciones.length ? Math.min(...posiciones) : null,
  };
}
