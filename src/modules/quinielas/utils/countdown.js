export function calcularTiempoRestante(fechaCierre, ahora = new Date()) {
  const diffMs = new Date(fechaCierre).getTime() - ahora.getTime();
  if (diffMs <= 0) {
    return { dias: 0, horas: 0, minutos: 0, segundos: 0, vencido: true };
  }
  const totalSegundos = Math.floor(diffMs / 1000);
  const dias = Math.floor(totalSegundos / 86400);
  const horas = Math.floor((totalSegundos % 86400) / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  return { dias, horas, minutos, segundos, vencido: false };
}

export function estaBloqueado(fechaCierre, ahora = new Date()) {
  return new Date(fechaCierre).getTime() <= ahora.getTime();
}
