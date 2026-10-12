import { alertaAdvertencia, alertaError, alertaExito } from '@/lib/alertas';
import { obtenerDatosParaResultados } from '../services/adminService';
import { generarImagenResultados } from './imagenResultados';
import { calcularTablaResultados } from './tablaResultados';

export function nombreArchivo(jornada, sufijo = '') {
  return `${jornada.nombre.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'jornada'}${sufijo}.png`;
}

export async function compartirBlobImagen(blob, nombre, jornada, texto) {
  const archivo = new File([blob], nombre, { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [archivo] })) {
    await navigator.share({ title: jornada.nombre, text: texto, files: [archivo] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
  await alertaExito('Imagen descargada', 'Ya está lista para compartir.');
}

// Genera y comparte la imagen con los resultados de la jornada (aciertos en verde y, al finalizar, ganadores en amarillo).
export async function compartirResultadosJornada(jornada) {
  try {
    const { partidos, entradas } = await obtenerDatosParaResultados(jornada.id);
    if (!entradas.length) {
      await alertaAdvertencia('Sin entradas', 'Todavía no hay entradas aprobadas para mostrar.');
      return;
    }
    const tabla = calcularTablaResultados({ partidos, entradas, estatus: jornada.estatus });
    const blob = await generarImagenResultados({ jornada, tabla, premio: jornada.premio });
    await compartirBlobImagen(blob, nombreArchivo(jornada, '-resultados'), jornada, `Resultados de ${jornada.nombre}`);
  } catch (error) {
    if (error.name !== 'AbortError') await alertaError(error, 'No se pudo generar la imagen de resultados');
  }
}
