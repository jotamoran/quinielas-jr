const ESCALA = 2;
const MARGEN = 24;
const ANCHO_INDICE = 38;
const ANCHO_NOMBRE = 190;
const ANCHO_PARTIDO = 78;
const ANCHO_PUNTOS = 92;
const ALTO_FILA = 30;
const ANCHO_PANEL = 290;
const COLOR = {
  azul: '#8db4e2', azulClaro: '#b4c6e7', amarillo: '#ffe699', naranja: '#f4b183',
  acierto: '#00b050', ganador: '#ffff00', linea: '#1a1a1a', panel: '#d9e1f2', rojo: '#ff0000',
};

function lineas(ctx, texto, ancho) {
  const resultado = [];
  let actual = '';
  texto.split(' ').forEach((palabra) => {
    const prueba = `${actual} ${palabra}`.trim();
    if (ctx.measureText(prueba).width <= ancho) actual = prueba;
    else { if (actual) resultado.push(actual); actual = palabra; }
  });
  if (actual) resultado.push(actual);
  return resultado;
}

function celda(ctx, x, y, ancho, alto, { relleno = '#ffffff', texto = '', color = '#111111', fuente = '600 14px Inter, Arial', alinear = 'center' } = {}) {
  ctx.fillStyle = relleno;
  ctx.fillRect(x, y, ancho, alto);
  ctx.strokeStyle = COLOR.linea;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, ancho - 1, alto - 1);
  if (!texto) return;
  ctx.fillStyle = color;
  ctx.font = fuente;
  ctx.textAlign = alinear;
  ctx.textBaseline = 'middle';
  const posicionX = alinear === 'left' ? x + 8 : alinear === 'right' ? x + ancho - 8 : x + ancho / 2;
  ctx.fillText(texto, posicionX, y + alto / 2 + 1, ancho - 12);
}

function dibujar(ctx, { jornada, tabla, premio, finalizada, generadoEn }) {
  const { columnas, filas, resultadosCapturados } = tabla;
  const xTabla = MARGEN;
  const anchoPartidos = columnas.length * ANCHO_PARTIDO;
  const anchoTabla = ANCHO_INDICE + ANCHO_NOMBRE + anchoPartidos + ANCHO_PUNTOS;
  const xPartidos = xTabla + ANCHO_INDICE + ANCHO_NOMBRE;
  const xPuntos = xPartidos + anchoPartidos;

  // Encabezado de partidos: LOCAL / RESULTADO / VISITANTE
  const yEncabezado = MARGEN;
  const etiquetas = [['LOCAL', COLOR.azul], ['RESULTADO', COLOR.amarillo], ['VISITANTE', COLOR.naranja]];
  etiquetas.forEach(([texto, relleno], fila) => {
    const y = yEncabezado + fila * ALTO_FILA;
    celda(ctx, xTabla, y, ANCHO_INDICE + ANCHO_NOMBRE, ALTO_FILA, { relleno, texto, fuente: '700 13px Inter, Arial' });
    columnas.forEach((columna, indice) => {
      const x = xPartidos + indice * ANCHO_PARTIDO;
      const textos = [columna.local, columna.cancelado ? 'CANC.' : (columna.resultado ?? ''), columna.visitante];
      celda(ctx, x, y, ANCHO_PARTIDO, ALTO_FILA, { relleno, texto: textos[fila], fuente: fila === 1 ? '800 16px Inter, Arial' : '700 11px Inter, Arial' });
    });
    const textosFinal = ['FINAL', String(resultadosCapturados), 'PUNTOS'];
    celda(ctx, xPuntos, y, ANCHO_PUNTOS, ALTO_FILA, { relleno, texto: textosFinal[fila], fuente: '700 13px Inter, Arial' });
  });

  // Cabecera de participantes
  const yTabla = yEncabezado + 3 * ALTO_FILA + 18;
  celda(ctx, xTabla, yTabla, ANCHO_INDICE + ANCHO_NOMBRE, ALTO_FILA, { relleno: COLOR.azul, texto: 'PARTICIPANTES', fuente: '700 13px Inter, Arial' });
  celda(ctx, xPartidos, yTabla, anchoPartidos, ALTO_FILA, { relleno: COLOR.azul, texto: 'PREDICCIONES', fuente: '700 13px Inter, Arial' });
  celda(ctx, xPuntos, yTabla, ANCHO_PUNTOS, ALTO_FILA, { relleno: COLOR.azulClaro, texto: 'PUNTOS', fuente: '700 13px Inter, Arial' });

  filas.forEach((fila, indice) => {
    const y = yTabla + ALTO_FILA + indice * ALTO_FILA;
    celda(ctx, xTabla, y, ANCHO_INDICE, ALTO_FILA, { texto: String(indice + 1), alinear: 'right', fuente: '500 13px Inter, Arial' });
    celda(ctx, xTabla + ANCHO_INDICE, y, ANCHO_NOMBRE, ALTO_FILA, { relleno: fila.ganador ? COLOR.ganador : '#ffffff', texto: fila.nombre, alinear: 'left', fuente: fila.ganador ? '800 14px Inter, Arial' : '500 14px Inter, Arial' });
    fila.celdas.forEach((c, columna) => {
      celda(ctx, xPartidos + columna * ANCHO_PARTIDO, y, ANCHO_PARTIDO, ALTO_FILA, {
        relleno: c.acierto ? COLOR.acierto : '#ffffff',
        texto: c.pronostico,
        color: c.acierto ? '#ffffff' : '#111111',
        fuente: c.acierto ? '800 15px Inter, Arial' : '500 15px Inter, Arial',
      });
    });
    celda(ctx, xPuntos, y, ANCHO_PUNTOS, ALTO_FILA, { relleno: COLOR.azulClaro, texto: String(fila.aciertos), fuente: '700 15px Inter, Arial' });
  });

  const yFinTabla = yTabla + ALTO_FILA + filas.length * ALTO_FILA;

  // Panel derecho: jornada, leyenda, premio y reglas
  const xPanel = xTabla + anchoTabla + 24;
  let y = yEncabezado;
  celda(ctx, xPanel, y, ANCHO_PANEL, ALTO_FILA + 4, { relleno: COLOR.panel, texto: jornada.nombre.trim().toUpperCase(), fuente: '700 14px Inter, Arial' });
  y += ALTO_FILA + 22;
  [['V', 'VISITANTE'], ['E', 'EMPATE'], ['L', 'LOCAL']].forEach(([letra, nombre]) => {
    celda(ctx, xPanel + ANCHO_PANEL - 190, y, 70, 26, { relleno: COLOR.amarillo, texto: letra, fuente: '800 14px Inter, Arial' });
    celda(ctx, xPanel + ANCHO_PANEL - 120, y, 120, 26, { relleno: COLOR.azul, texto: nombre, fuente: '700 12px Inter, Arial' });
    y += 26;
  });
  y += 18;
  celda(ctx, xPanel, y, ANCHO_PANEL, 28, { relleno: COLOR.panel, texto: 'PREMIO:', fuente: '700 14px Inter, Arial' });
  y += 28;
  celda(ctx, xPanel, y, ANCHO_PANEL, 30, { relleno: COLOR.ganador, texto: `$${Number(premio ?? 0).toLocaleString('es-MX')}`, fuente: '800 17px Inter, Arial' });
  y += 54;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111111';
  ctx.font = '500 13px Inter, Arial';
  const reglaGanador = 'Al que mayor aciertos tenga, en caso de empate el premio se repartirá entre las personas involucradas.';
  lineas(ctx, reglaGanador, ANCHO_PANEL).forEach((linea) => { ctx.fillText(linea, xPanel, y); y += 18; });
  y += 10;
  celda(ctx, xPanel, y, 120, 24, { relleno: COLOR.rojo, texto: 'POR TARUGO', color: '#ffffff', fuente: '800 12px Inter, Arial' });
  y += 44;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111111';
  ctx.font = '500 13px Inter, Arial';
  const reglaTarugo = 'La persona con menos aciertos ganará una quiniela gratis para la siguiente jornada, en caso de empate NADIE se llevará el premio.';
  lineas(ctx, reglaTarugo, ANCHO_PANEL).forEach((linea) => { ctx.fillText(linea, xPanel, y); y += 18; });

  // Pie
  ctx.fillStyle = '#44504a';
  ctx.font = '500 12px Inter, Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Quinielas JR · ${finalizada ? 'Resultado final' : 'Resultados al momento'} · ${generadoEn}`, xTabla, yFinTabla + 24);

  return { ancho: xPanel + ANCHO_PANEL + MARGEN, alto: Math.max(yFinTabla + 44, y + MARGEN) };
}

function dimensionar(jornada, tabla, premio) {
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d');
  return dibujar(ctx, { jornada, tabla, premio, finalizada: false, generadoEn: '' });
}

export async function generarImagenResultados({ jornada, tabla, premio, generadoEn = new Date() }) {
  const finalizada = jornada.estatus === 'finalizada';
  const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(generadoEn);
  const { ancho, alto } = dimensionar(jornada, tabla, premio);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho * ESCALA;
  lienzo.height = alto * ESCALA;
  const ctx = lienzo.getContext('2d');
  ctx.scale(ESCALA, ESCALA);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ancho, alto);
  dibujar(ctx, { jornada, tabla, premio, finalizada, generadoEn: `${fecha} (CDMX)` });
  return new Promise((resolver, rechazar) => lienzo.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo generar la imagen'))), 'image/png'));
}
