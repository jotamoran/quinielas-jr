const NOMBRES_CORTOS = {
  'tigres uanl': 'TIGRES',
  'pumas unam': 'PUMAS',
  'cd guadalajara': 'CHIVAS',
  'guadalajara': 'CHIVAS',
  'atletico de san luis': 'SAN LUIS',
  'santos laguna': 'SANTOS',
  'cruz azul': 'CRUZ AZUL',
  'club america': 'AMERICA',
  'fc juarez': 'JUAREZ',
  'club leon': 'LEON',
};

function sinAcentos(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function nombreCorto(nombre) {
  const limpio = sinAcentos(nombre).trim();
  return NOMBRES_CORTOS[limpio.toLowerCase()] ?? limpio.toUpperCase();
}

const etiquetaPronostico = (valor) => (['L', 'E', 'V'].includes(valor) ? valor : '');

// Arma los datos de la tabla de resultados compartible (sin dibujar).
// En una jornada abierta solo se marcan los aciertos; al finalizar también se marcan los ganadores.
export function calcularTablaResultados({ partidos, entradas, estatus }) {
  const columnas = [...partidos]
    .sort((a, b) => new Date(a.fecha_partido) - new Date(b.fecha_partido))
    .map((partido) => ({
      id: partido.id,
      local: nombreCorto(partido.equipo_local),
      visitante: nombreCorto(partido.equipo_visitante),
      cancelado: Boolean(partido.cancelado),
      resultado: !partido.cancelado ? etiquetaPronostico(partido.resultado_oficial) || null : null,
    }));

  const filas = entradas.map((entrada) => {
    const porPartido = new Map((entrada.predicciones ?? []).map((p) => [p.partido_id, p.pronostico]));
    const celdas = columnas.map((columna) => {
      const pronostico = etiquetaPronostico(porPartido.get(columna.id));
      return { pronostico, acierto: Boolean(columna.resultado) && pronostico === columna.resultado };
    });
    return { nombre: entrada.nombre, celdas, aciertos: celdas.filter((celda) => celda.acierto).length, ganador: false };
  });

  if (estatus === 'finalizada' && filas.length) {
    const maximo = Math.max(...filas.map((fila) => fila.aciertos));
    filas.forEach((fila) => { fila.ganador = fila.aciertos === maximo; });
  }
  return { columnas, filas, resultadosCapturados: columnas.filter((columna) => columna.resultado).length };
}
