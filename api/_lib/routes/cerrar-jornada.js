import { requireAdmin, ErrorHttp, responderError } from '../auth.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { calcularGanadoresYPeor } from '../premios.js';
import { escaparHtml } from '../email.js';
import { enviarAvisoUnico } from '../avisoUnico.js';
import { etiquetaAciertos } from '../textos.js';
import { avisarAdministradores } from '../avisosAdministradores.js';

// Núcleo del cierre: lo usan el botón del admin y el cierre automático.
export async function ejecutarCierre(supabaseAdmin, jornada_id, { reenviar = false } = {}) {
  const { data: resumen, error } = await supabaseAdmin.rpc('finalizar_jornada_con_resumen', {
    p_jornada_id: jornada_id,
    p_reenviar: reenviar,
  });
  if (error) throw error;
  if (!resumen?.jornada || !Array.isArray(resumen.ranking)) throw new ErrorHttp(500, 'La base no devolvió el resumen del cierre');
  const { jornada, ranking, codigoCuponPeor, pagosPendientes } = resumen;
  if (ranking.length === 0) throw new ErrorHttp(400, 'No hay quinielas aprobadas en esta jornada');

  const entradas = ranking.map((r) => ({ quinielaId: r.quiniela_id, usuarioId: r.usuario_id, aciertos: r.aciertos }));
  const { ganadores, peor } = calcularGanadoresYPeor(entradas, jornada.premio ?? null);

  // Los correos son best-effort y se registran por destinatario: se pueden reintentar sin duplicar.
  const avisos = [];
  async function avisar(etiqueta, clave, preparar) {
    try {
      const correo = await preparar();
      if (!correo) return;
      const enviado = await enviarAvisoUnico(supabaseAdmin, `cierre:${jornada_id}:${clave}`, correo);
      if (!enviado) avisos.push(`${etiqueta}: envío en curso`);
    } catch (e) {
      console.error(`cerrar-jornada (${jornada_id}) — falló ${etiqueta} (${e?.name ?? 'Error'})`);
      avisos.push(`${etiqueta}: pendiente`);
    }
  }

  const nombreJornada = escaparHtml(jornada.nombre ?? 'la jornada');
  const porId = new Map(ranking.map((fila) => [fila.quiniela_id, fila]));
  const quinielaPeor = peor ? porId.get(peor.quinielaId) : null;

  if (codigoCuponPeor && quinielaPeor?.correo_contacto && !quinielaPeor.usuario_id) {
    await avisar('correo del cupón "Por tarugo"', `cupon:${peor.quinielaId}`, async () => ({
      to: quinielaPeor.correo_contacto,
      subject: `Tu cupón "Por tarugo" de ${jornada.nombre ?? 'la jornada'}`,
      heading: '🎟️ Ganaste un cupón "Por tarugo"',
      bodyHtml: `<p>Hola, tu quiniela "${escaparHtml(quinielaPeor.alias ?? 'Entrada')}" fue la que menos aciertos tuvo en <b>${nombreJornada}</b>, así que te ganaste un cupón de consolación para tu próximo registro.</p><p>Código: <b>${escaparHtml(codigoCuponPeor)}</b></p><p>Preséntalo con quien te registró para usarlo en tu siguiente quiniela.</p>`,
    }));
  }

  // Ganadores de premio sin cuenta (registro presencial) pero con correo de contacto.
  for (const ganador of ganadores) {
    if (ganador.usuarioId) continue;
    await avisar(`correo de premio (sin cuenta) a quiniela ${ganador.quinielaId}`, `premio:${ganador.quinielaId}`, async () => {
      const quinielaGanadora = porId.get(ganador.quinielaId);
      if (!quinielaGanadora?.correo_contacto) return null;
      return {
        to: quinielaGanadora.correo_contacto,
        subject: `¡Ganaste! ${jornada.nombre ?? 'Resultado final'}`,
        heading: '🏆 ¡Felicidades, ganaste el premio!',
        bodyHtml: `<p>Hola, tu quiniela "${escaparHtml(quinielaGanadora.alias ?? 'Entrada')}" ganó <b>$${ganador.montoPremio.toFixed(2)}</b> de premio en <b>${nombreJornada}</b>.</p><p>Contacta a quien te registró para que te haga llegar tu premio.</p>`,
      };
    });
  }

  for (const participante of ranking) {
    if (!participante.usuario_id) continue;

    const gano = ganadores.find((g) => g.quinielaId === participante.quiniela_id);
    const esPeor = peor?.quinielaId === participante.quiniela_id;
    const ganoCupon = esPeor && codigoCuponPeor;
    if (!gano && !ganoCupon) continue;

    await avisar(`correo a la entrada ${participante.quiniela_id}`, `resultado:${participante.quiniela_id}`, async () => {
      const correo = participante.correo_contacto;
      if (!correo) return null;

      let extra = '';
      if (gano) extra += `<p>🏆 ¡Felicidades! Ganaste $${gano.montoPremio.toFixed(2)} de premio.</p>`;
      if (ganoCupon) extra += `<p>🎟️ Te ganaste un cupón "Por tarugo" gratis para tu próximo registro. Código: <b>${escaparHtml(codigoCuponPeor)}</b></p>`;

      return {
        to: correo,
        subject: `Resultado final: ${jornada.nombre ?? 'tu jornada'}`,
        heading: `Resultado de ${nombreJornada}`,
        bodyHtml: `<p>Hola ${escaparHtml(participante.nombre_completo ?? '')}, tu quiniela "${escaparHtml(participante.alias ?? 'Entrada')}" obtuvo <b>${etiquetaAciertos(participante.aciertos)}</b> y quedó en la posición <b>${participante.posicion}</b>.</p>${extra}`,
      };
    });
  }

  const nombresGanadores = ganadores.map((ganador) => {
    const participante = porId.get(ganador.quinielaId);
    return `<li>${escaparHtml(participante?.alias || participante?.nombre_completo || 'Entrada')} — ${etiquetaAciertos(participante?.aciertos)}; premio: $${ganador.montoPremio.toFixed(2)}; correo: ${escaparHtml(participante?.correo_contacto || 'sin correo')}; teléfono: ${escaparHtml(participante?.telefono || 'sin teléfono')}</li>`;
  }).join('');
  const detallePeor = peor ? `<p>Último lugar: ${escaparHtml(quinielaPeor?.alias || quinielaPeor?.nombre_completo || 'Entrada')}; cupón: ${codigoCuponPeor ? escaparHtml(codigoCuponPeor) : 'no asignado'}.</p>` : '<p>No hubo un último lugar único; no se asignó cupón.</p>';
  const pagos = pagosPendientes > 0 ? `<p>Quedaron fuera del ranking ${pagosPendientes} entrada(s) con pago pendiente.</p>` : '<p>Sin pagos pendientes.</p>';
  try {
    const pendientesAdmin = await avisarAdministradores(supabaseAdmin, `cierre:${jornada_id}:resumen`, {
      subject: `Resumen de cierre: ${jornada.nombre ?? 'Jornada'}`,
      heading: `Resumen de ${nombreJornada}`,
      bodyHtml: `<p>La jornada quedó finalizada con un premio de <b>$${Number(jornada.premio ?? 0).toFixed(2)}</b>.</p><p>Ganador(es):</p><ul>${nombresGanadores}</ul>${detallePeor}${pagos}`,
    });
    avisos.push(...pendientesAdmin.map((id) => `resumen para administrador ${id}: pendiente`));
  } catch (errorAviso) {
    console.error(`cerrar-jornada (${jornada_id}) — falló el resumen a administradores (${errorAviso?.name ?? 'Error'})`);
    avisos.push('resumen para administradores: pendiente');
  }

  if (avisos.length === 0) {
    const { error: errorActualizacion } = await supabaseAdmin.from('cierres_jornada')
      .update({ avisos_completados_el: new Date().toISOString() }).eq('jornada_id', jornada_id);
    if (errorActualizacion) {
      console.error(`cerrar-jornada (${jornada_id}) — no se pudo marcar el envío completo (${errorActualizacion?.name ?? 'Error'})`);
      avisos.push('confirmación de avisos: pendiente');
    }
  }

  return {
    cuerpo: { status: 'ok', ganadores, peor, cuponGenerado: Boolean(codigoCuponPeor), avisos: avisos.length ? avisos : undefined, pagosPendientes },
    jornada,
    ranking,
  };
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { jornada_id, reenviar_avisos: reenviar = false } = req.body ?? {};
    if (!jornada_id) return res.status(400).json({ error: 'Falta jornada_id' });

    const { cuerpo } = await ejecutarCierre(getSupabaseAdmin(), jornada_id, { reenviar });
    return res.status(200).json(cuerpo);
  } catch (e) {
    return responderError(res, e, 'cerrar-jornada');
  }
}
