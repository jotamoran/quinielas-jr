export function calcularGanadoresYPeor(entradas, premioTotal) {
  if (entradas.length === 0) return { ganadores: [], peor: null };

  const maxAciertos = Math.max(...entradas.map((e) => e.aciertos));
  const minAciertos = Math.min(...entradas.map((e) => e.aciertos));

  const primerosLugares = entradas.filter((e) => e.aciertos === maxAciertos);
  const ultimosLugares = entradas.filter((e) => e.aciertos === minAciertos);

  const montoPorGanador = premioTotal ? Number(premioTotal) / primerosLugares.length : 0;
  const ganadores = primerosLugares.map((e) => ({
    quinielaId: e.quinielaId,
    usuarioId: e.usuarioId,
    montoPremio: montoPorGanador,
  }));

  const peor = ultimosLugares.length === 1
    ? { quinielaId: ultimosLugares[0].quinielaId, usuarioId: ultimosLugares[0].usuarioId }
    : null;

  return { ganadores, peor };
}
