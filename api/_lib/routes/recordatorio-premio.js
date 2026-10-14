import { createHash, timingSafeEqual } from 'node:crypto';
import { ErrorHttp, responderError } from '../auth.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { avisarAdministradores } from '../avisosAdministradores.js';
import { escaparHtml } from '../email.js';

const TREINTA_MINUTOS = 30 * 60 * 1000;

function secretoValido(recibido) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) throw new ErrorHttp(503, 'El recordatorio no está configurado');
  const huella = (valor) => createHash('sha256').update(String(valor ?? '')).digest();
  return timingSafeEqual(huella(recibido), huella(esperado));
}

export async function procesarRecordatorioPremio(supabaseAdmin, jornadaId, ahora = new Date()) {
  const { data: jornada, error: errorJornada } = await supabaseAdmin.from('jornadas')
    .select('nombre, premio, estatus, fecha_cierre').eq('id', jornadaId).maybeSingle();
  if (errorJornada) throw errorJornada;
  if (!jornada) throw new ErrorHttp(404, 'La jornada no existe');
  if (!['activa', 'cerrada'].includes(jornada.estatus) || Number(jornada.premio ?? 0) > 0) return { estado: 'omitida' };

  const { data: partidos, error: errorPartidos } = await supabaseAdmin.from('partidos')
    .select('fecha_partido, cancelado').eq('jornada_id', jornadaId);
  if (errorPartidos) throw errorPartidos;

  const fechasPartidos = (partidos ?? []).filter((partido) => !partido.cancelado)
    .map((partido) => new Date(partido.fecha_partido).getTime()).filter(Number.isFinite);
  const fechaCierre = new Date(jornada.fecha_cierre).getTime();
  const fechaPrimerPartido = fechasPartidos.length ? Math.min(...fechasPartidos) : Number.POSITIVE_INFINITY;
  const fechas = [fechaPrimerPartido, fechaCierre].filter(Number.isFinite);
  if (fechas.length === 0) return { estado: 'omitida' };

  const fechaLimite = Math.min(...fechas);
  if (ahora.getTime() < fechaLimite - TREINTA_MINUTOS) return { estado: 'espera' };

  const fecha = new Date(fechaLimite).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  const evento = fechaCierre <= fechaPrimerPartido ? 'el cierre del registro' : 'el inicio del primer partido';
  const pendientes = await avisarAdministradores(supabaseAdmin, `premio-pendiente:${jornadaId}`, {
    subject: `Falta registrar el premio de ${jornada.nombre ?? 'la jornada'}`,
    heading: '⚠️ Falta definir el premio',
    bodyHtml: `<p>La jornada <b>${escaparHtml(jornada.nombre ?? 'sin nombre')}</b> todavía no tiene un premio registrado.</p><p>La fecha programada para ${evento} es el ${fecha}. Registra el monto del premio en Administración → Ver jornadas.</p>`,
  });
  return pendientes.length ? { estado: 'pendiente', administradores: pendientes } : { estado: 'avisado' };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    if (!secretoValido(req.headers?.['x-cron-secret'])) return res.status(401).json({ error: 'No autorizado' });
    const { jornada_id: jornadaId } = req.body ?? {};
    if (!jornadaId) return res.status(400).json({ error: 'Falta jornada_id' });
    return res.status(200).json(await procesarRecordatorioPremio(getSupabaseAdmin(), jornadaId));
  } catch (error) {
    return responderError(res, error, 'recordatorio-premio');
  }
}
