export const ZONA_HORARIA = 'America/Mexico_City';

export function formatearFecha(valor, opciones = {}) {
  if (!valor) return '';
  return new Intl.DateTimeFormat('es-MX', { timeZone: ZONA_HORARIA, ...opciones }).format(new Date(valor));
}

export function fechaParaInput(valor) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(valor)).reduce((resultado, parte) => { resultado[parte.type] = parte.value; return resultado; }, {});
  return `${partes.year}-${partes.month}-${partes.day}`;
}

export function fechaHoraParaInput(valor) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(valor)).reduce((resultado, parte) => { resultado[parte.type] = parte.value; return resultado; }, {});
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour === '24' ? '00' : partes.hour}:${partes.minute}`;
}

export function hoyParaInput() {
  return fechaParaInput(new Date());
}

export function ahoraParaDatetimeInput() {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(ahora).reduce((resultado, parte) => { resultado[parte.type] = parte.value; return resultado; }, {});
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
}

export function fechaCDMXaISO(fecha, hora = '23:59:59') {
  const aproximada = new Date(`${fecha}T${hora}Z`);
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(aproximada).reduce((resultado, parte) => {
    resultado[parte.type] = parte.value;
    return resultado;
  }, {});
  const horaLocalComoUTC = Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day), Number(partes.hour) % 24, Number(partes.minute), Number(partes.second));
  const desfase = horaLocalComoUTC - aproximada.getTime();
  return new Date(aproximada.getTime() - desfase).toISOString();
}
