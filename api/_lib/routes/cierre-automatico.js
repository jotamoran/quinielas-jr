import { createHash, timingSafeEqual } from 'node:crypto';
import { ErrorHttp, responderError } from '../auth.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { calcularGanadoresYPeor } from '../premios.js';
import { escaparHtml } from '../email.js';
import { avisarAdministradores } from '../avisosAdministradores.js';
import { findFinalResults, FOOTBALL_PROVIDER } from '../football/provider.js';
import { ejecutarCierre } from './cerrar-jornada.js';

const MINUTOS_GRACIA = 5;
const HORAS_MAXIMAS_SIN_CONFIRMAR = 3;

function secretoValido(recibido) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) throw new ErrorHttp(503, 'El cierre automático no está configurado');
  const huella = (valor) => createHash('sha256').update(String(valor ?? '')).digest();
  return timingSafeEqual(huella(recibido), huella(esperado));
}

// Decide si la jornada ya puede cerrarse. Devuelve { estado: 'listo' | 'espera' | 'bloqueo', codigo, motivo }.
export function evaluarCierre({ partidos, ahora, resultadosProveedor, entradasAprobadas, minutosGracia = MINUTOS_GRACIA }) {
  const activos = partidos.filter((partido) => !partido.cancelado);
  if (!activos.length) return { estado: 'bloqueo', codigo: 'sin_partidos', motivo: 'La jornada no tiene partidos activos.' };

  const sinResultado = activos.filter((partido) => !partido.resultado_oficial);
  if (sinResultado.length) return { estado: 'espera', codigo: 'faltan_resultados', motivo: `Faltan ${sinResultado.length} resultado(s) oficiales.` };

  const ultimoCambio = Math.max(...activos.map((partido) => new Date(partido.actualizado_el ?? partido.fecha_partido).getTime()));
  const finGracia = ultimoCambio + minutosGracia * 60 * 1000;
  if (ahora.getTime() < finGracia) return { estado: 'espera', codigo: 'gracia', motivo: `En periodo de gracia hasta ${new Date(finGracia).toISOString()}.` };

  const verificables = activos.filter((partido) => partido.provider === FOOTBALL_PROVIDER && partido.external_fixture_id);
  // resultadosProveedor === null significa que todavía no se consulta al proveedor.
  if (resultadosProveedor === null && verificables.length) return { estado: 'consultar_proveedor', codigo: 'consultar_proveedor', motivo: 'Falta confirmar con el proveedor.' };
  const discrepancias = [];
  let sinConfirmar = 0;
  for (const partido of verificables) {
    const id = String(partido.external_fixture_id);
    const delProveedor = resultadosProveedor.get(id);
    if (resultadosProveedor.fallidos?.includes(id) || !delProveedor) sinConfirmar += 1;
    else if (delProveedor !== partido.resultado_oficial) discrepancias.push(`${partido.equipo_local} vs ${partido.equipo_visitante}: guardado ${partido.resultado_oficial}, proveedor ${delProveedor}`);
  }
  if (discrepancias.length) {
    return { estado: 'bloqueo', codigo: 'discrepancia', motivo: `El proveedor reporta un resultado distinto al guardado: ${discrepancias.join('; ')}.` };
  }
  if (sinConfirmar) {
    const horasDesdeGracia = (ahora.getTime() - finGracia) / 3600000;
    if (horasDesdeGracia > HORAS_MAXIMAS_SIN_CONFIRMAR) {
      return { estado: 'bloqueo', codigo: 'sin_confirmacion', motivo: `No se pudo confirmar ${sinConfirmar} resultado(s) con el proveedor en más de ${HORAS_MAXIMAS_SIN_CONFIRMAR} horas.` };
    }
    return { estado: 'espera', codigo: 'sin_confirmacion_aun', motivo: `Aún no se confirma ${sinConfirmar} resultado(s) con el proveedor.` };
  }

  if (!entradasAprobadas) return { estado: 'bloqueo', codigo: 'sin_entradas', motivo: 'No hay entradas aprobadas en la jornada.' };
  return { estado: 'listo', codigo: 'listo', motivo: 'Todo en orden.' };
}

async function avisarAdmins(supabaseAdmin, claveBase, { asunto, titulo, cuerpoHtml }) {
  return avisarAdministradores(supabaseAdmin, claveBase, { subject: asunto, heading: titulo, bodyHtml: cuerpoHtml });
}

function nombreEntrada(fila) {
  return escaparHtml(fila?.alias || fila?.nombre_completo || 'Entrada');
}

function resumenHtml({ ranking, ganadores, peor, premio, pagosPendientes, avisos, cuponGenerado }) {
  const porId = new Map(ranking.map((fila) => [fila.quiniela_id, fila]));
  const lista = ganadores.map((g) => `<li>${nombreEntrada(porId.get(g.quinielaId))} — $${g.montoPremio.toFixed(2)}</li>`).join('');
  const ultimo = peor ? `<p>Último lugar: <b>${nombreEntrada(porId.get(peor.quinielaId))}</b> (${cuponGenerado ? 'cupón "Por tarugo" asignado' : 'sin medio de contacto para el cupón'}).</p>` : '<p>Sin último lugar único: no se asigna cupón.</p>';
  const pagos = pagosPendientes > 0 ? `<p><b>Atención:</b> ${pagosPendientes} entrada(s) con pago pendiente quedaron fuera del ranking.</p>` : '';
  const correos = avisos?.length ? `<p>Hubo correos sin enviar (puedes reintentarlos en Administración → Cerrar jornada):</p><ul>${avisos.map((a) => `<li>${escaparHtml(a)}</li>`).join('')}</ul>` : '';
  return `<p>Premio total: <b>$${Number(premio ?? 0).toFixed(2)}</b></p><p>Ganador(es):</p><ul>${lista}</ul>${ultimo}${pagos}${correos}`;
}

export async function procesarCierreAutomatico(supabaseAdmin, { jornadaId, modo, ahora = new Date() }) {
  const { data: jornada, error: errorJornada } = await supabaseAdmin.from('jornadas').select('nombre, premio, estatus').eq('id', jornadaId).maybeSingle();
  if (errorJornada) throw errorJornada;
  if (!jornada) throw new ErrorHttp(404, 'La jornada no existe');
  if (jornada.estatus === 'finalizada') {
    const { data: cierre, error: errorCierre } = await supabaseAdmin.from('cierres_jornada')
      .select('avisos_completados_el').eq('jornada_id', jornadaId).maybeSingle();
    if (errorCierre) throw errorCierre;
    if (cierre?.avisos_completados_el) return { estado: 'omitida', motivo: 'Los avisos del cierre ya se completaron.', modo };
    const { cuerpo } = await ejecutarCierre(supabaseAdmin, jornadaId, { reenviar: true });
    return { estado: 'avisos_reintentados', modo, avisos: cuerpo.avisos };
  }
  if (!['activa', 'cerrada'].includes(jornada.estatus)) return { estado: 'omitida', motivo: `La jornada está ${jornada.estatus}.` };

  const { data: partidos, error: errorPartidos } = await supabaseAdmin
    .from('partidos')
    .select('id, equipo_local, equipo_visitante, cancelado, resultado_oficial, actualizado_el, fecha_partido, provider, external_fixture_id')
    .eq('jornada_id', jornadaId);
  if (errorPartidos) throw errorPartidos;

  const { count: entradasAprobadas, error: errorEntradas } = await supabaseAdmin
    .from('vista_ranking_jornada').select('quiniela_id', { count: 'exact', head: true }).eq('jornada_id', jornadaId);
  if (errorEntradas) throw errorEntradas;

  // Solo se consulta al proveedor cuando todo lo demás ya está listo para cerrar.
  const base = { partidos, ahora, entradasAprobadas: entradasAprobadas ?? 0 };
  let evaluacion = evaluarCierre({ ...base, resultadosProveedor: null });
  if (evaluacion.estado === 'consultar_proveedor') {
    const ids = partidos.filter((p) => !p.cancelado && p.provider === FOOTBALL_PROVIDER && p.external_fixture_id).map((p) => p.external_fixture_id);
    evaluacion = evaluarCierre({ ...base, resultadosProveedor: await findFinalResults(ids) });
  }
  const nombre = escaparHtml(jornada.nombre ?? 'la jornada');

  if (evaluacion.estado === 'espera') return { ...evaluacion, modo };
  if (evaluacion.estado === 'bloqueo') {
    await avisarAdmins(supabaseAdmin, `cierre-auto:${jornadaId}:bloqueo:${evaluacion.codigo}`, {
      asunto: `No se cerró automáticamente: ${jornada.nombre}`,
      titulo: '⚠️ La jornada no se cerró sola',
      cuerpoHtml: `<p>La jornada <b>${nombre}</b> no se cerró automáticamente.</p><p>${escaparHtml(evaluacion.motivo)}</p><p>Revísala y ciérrala manualmente en Administración → Cerrar jornada.</p>`,
    });
    return { ...evaluacion, modo };
  }

  const { count: pagosPendientes } = await supabaseAdmin.from('quinielas').select('id', { count: 'exact', head: true }).eq('jornada_id', jornadaId).eq('estatus_pago', 'pendiente');

  if (modo !== 'activo') {
    const { data: ranking, error } = await supabaseAdmin.from('vista_ranking_jornada').select('quiniela_id, usuario_id, nombre_completo, alias, aciertos, posicion').eq('jornada_id', jornadaId);
    if (error) throw error;
    const { ganadores, peor } = calcularGanadoresYPeor(ranking.map((r) => ({ quinielaId: r.quiniela_id, usuarioId: r.usuario_id, aciertos: r.aciertos })), jornada.premio ?? null);
    await avisarAdmins(supabaseAdmin, `cierre-auto:${jornadaId}:simulacro`, {
      asunto: `Simulacro de cierre automático: ${jornada.nombre}`,
      titulo: '🧪 Simulacro de cierre automático',
      cuerpoHtml: `<p>La jornada <b>${nombre}</b> estaba lista para cerrarse sola, pero el cierre automático está en modo simulacro, así que NO se cerró.</p>${resumenHtml({ ranking, ganadores, peor, premio: jornada.premio, pagosPendientes: pagosPendientes ?? 0, avisos: [], cuponGenerado: Boolean(peor) })}<p>Ciérrala manualmente o activa el cierre automático real.</p>`,
    });
    return { ...evaluacion, estado: 'simulacro', modo };
  }

  const { cuerpo } = await ejecutarCierre(supabaseAdmin, jornadaId);
  return { estado: 'cerrada', motivo: evaluacion.motivo, modo, avisos: cuerpo.avisos };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    if (!secretoValido(req.headers['x-cron-secret'])) return res.status(401).json({ error: 'No autorizado' });

    const { jornada_id: jornadaId, modo } = req.body ?? {};
    if (!jornadaId || !['simulacro', 'activo'].includes(modo)) return res.status(400).json({ error: 'Faltan jornada_id o modo' });

    return res.status(200).json(await procesarCierreAutomatico(getSupabaseAdmin(), { jornadaId, modo }));
  } catch (error) {
    return responderError(res, error, 'cierre-automatico');
  }
}
