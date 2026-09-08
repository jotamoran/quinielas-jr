import logoUrl from '@/assets/logo.png';

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => resolve(imagen);
    imagen.onerror = reject;
    imagen.src = src;
  });
}

function textoAjustado(ctx, texto, x, y, ancho, altoLinea, maxLineas = 2) {
  const palabras = texto.split(' ');
  const lineas = [];
  let linea = '';
  palabras.forEach((palabra) => {
    const prueba = `${linea} ${palabra}`.trim();
    if (ctx.measureText(prueba).width <= ancho) linea = prueba;
    else {
      lineas.push(linea);
      linea = palabra;
    }
  });
  if (linea) lineas.push(linea);
  lineas.slice(0, maxLineas).forEach((item, index) => ctx.fillText(item, x, y + index * altoLinea));
}

export async function generarImagenJornada(jornada) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  const partidos = [...(jornada.partidos ?? [])].sort((a, b) => new Date(a.fecha_partido) - new Date(b.fecha_partido));

  ctx.fillStyle = '#f4f6f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#073b28';
  ctx.fillRect(0, 0, canvas.width, 250);
  ctx.fillStyle = '#d6a800';
  ctx.fillRect(0, 240, canvas.width, 10);

  try {
    const logo = await cargarImagen(logoUrl);
    ctx.drawImage(logo, 74, 45, 130, 130);
  } catch {}

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 54px Inter, Arial';
  ctx.textAlign = 'left';
  ctx.fillText('QUINIELAS JR', 235, 105);
  ctx.font = '400 28px Inter, Arial';
  ctx.fillStyle = '#d9eee5';
  ctx.fillText('Haz tus 9 pronósticos', 238, 155);

  ctx.fillStyle = '#073b28';
  ctx.font = '700 42px Inter, Arial';
  ctx.fillText(jornada.nombre, 70, 330);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9a7600';
  ctx.fillText(`Premio: $${Number(jornada.premio ?? 0).toLocaleString('es-MX')}`, 1010, 330);

  const x = 70;
  const y = 380;
  const ancho = 940;
  const altoFila = 76;
  const columnas = [110, 315, 110, 315, 90];
  const encabezados = ['L', 'LOCAL', 'E', 'VISITANTE', 'V'];
  let cursor = x;
  encabezados.forEach((texto, index) => {
    ctx.fillStyle = index === 1 ? '#157a4a' : index === 3 ? '#d6a800' : '#073b28';
    ctx.fillRect(cursor, y, columnas[index], 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 23px Inter, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(texto, cursor + columnas[index] / 2, y + 41);
    cursor += columnas[index];
  });

  partidos.slice(0, 9).forEach((partido, fila) => {
    const filaY = y + 64 + fila * altoFila;
    cursor = x;
    columnas.forEach((columna, index) => {
      ctx.fillStyle = index === 1 ? '#e5f4ed' : index === 3 ? '#fff4c7' : '#ffffff';
      ctx.fillRect(cursor, filaY, columna, altoFila);
      ctx.strokeStyle = '#c8d0cc';
      ctx.lineWidth = 2;
      ctx.strokeRect(cursor, filaY, columna, altoFila);
      cursor += columna;
    });
    ctx.fillStyle = '#17231e';
    ctx.font = '700 23px Inter, Arial';
    ctx.textAlign = 'center';
    textoAjustado(ctx, partido.equipo_local.toUpperCase(), x + 110 + 157.5, filaY + 32, 275, 25);
    textoAjustado(ctx, partido.equipo_visitante.toUpperCase(), x + 535 + 157.5, filaY + 32, 275, 25);
  });

  ctx.fillStyle = '#073b28';
  ctx.font = '700 28px Inter, Arial';
  ctx.textAlign = 'left';
  ctx.fillText('NOMBRE:', 70, 1205);
  ctx.strokeStyle = '#56635d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(235, 1210);
  ctx.lineTo(1010, 1210);
  ctx.stroke();
  ctx.fillStyle = '#68746e';
  ctx.font = '400 21px Inter, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Marca L, E o V en cada partido', 540, 1285);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen')), 'image/png'));
}
