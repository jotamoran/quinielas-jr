export function etiquetaAciertos(cantidad) {
  return `${cantidad} ${Number(cantidad) === 1 ? 'acierto' : 'aciertos'}`;
}
