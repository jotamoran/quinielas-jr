// Resultado provisional de un partido en vivo según el marcador actual (null si no aplica).
export function resultadoProvisional(detalle) {
  if (detalle.cancelado || detalle.estado !== 'en_vivo') return null;
  const { puntos_local: local, puntos_visitante: visita } = detalle;
  if (local == null || visita == null) return null;
  if (local > visita) return 'L';
  if (local < visita) return 'V';
  return 'E';
}

// 'acierta' | 'falla' mientras el partido va en vivo; null en cualquier otro caso.
export function estadoEnVivo(detalle) {
  const provisional = resultadoProvisional(detalle);
  if (!provisional || !detalle.pronostico) return null;
  return provisional === detalle.pronostico ? 'acierta' : 'falla';
}
