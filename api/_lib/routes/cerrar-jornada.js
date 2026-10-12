import { requireAdmin, ErrorHttp, responderError } from '../auth.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { calcularGanadoresYPeor } from '../premios.js';
import { escaparHtml } from '../email.js';
import { enviarAvisoUnico } from '../avisoUnico.js';

// Núcleo del cierre: lo usan el botón del admin y el cierre automático.
export async function ejecutarCierre(supabaseAdmin, jornada_id, { reenviar = false } = {}) {
  const { data: jornada, error: errorJornada } = await supabaseAdmin.from('jornadas').select('nombre, premio, estatus').eq('id', jornada_id).maybeSingle();
  if (errorJornada) throw errorJornada;
  if (!jornada) throw new ErrorHttp(404, 'La jornada no existe');
  if (jornada.estatus === 'cancelada') throw new ErrorHttp(409, 'Esta jornada fue cancelada');
  if (jornada.estatus === 'finalizada' && !reenviar) throw new ErrorHttp(409, 'Esta jornada ya fue finalizada');
  if (jornada.estatus !== 'finalizada' && reenviar) throw new ErrorHttp(409, 'Solo se pueden reenviar los avisos de una jornada finalizada');

  const { data: ranking, error: errorRanking } = await supabaseAdmin
    .from('vista_ranking_jornada')
    .select('quiniela_id, usuario_id, nombre_completo, alias, aciertos, posicion')
    .eq('jornada_id', jornada_id);
  if (errorRanking) throw errorRanking;
  if (!ranking || ranking.length === 0) throw new ErrorHttp(400, 'No hay quinielas aprobadas en esta jornada');

  const entradas = ranking.map((r) => ({ quinielaId: r.quiniela_id, usuarioId: r.usuario_id, aciertos: r.aciertos }));
  const { ganadores, peor } = calcularGanadoresYPeor(entradas, jornada.premio ?? null);

  let quinielaPeor = null;
  if (peor && !peor.usuarioId) {
    const { data, error } = await supabaseAdmin.from('quinielas').select('alias, correo_contacto').eq('id', peor.quinielaId).single();
    if (error) throw error;
    quinielaPeor = data;
  }

  let codigoCuponPeor = null;
  if (reenviar) {
    const { data: cupon, error } = await supabaseAdmin.from('cupones').select('codigo').eq('jornada_origen_id', jornada_id).maybeSingle();
    if (error) throw error;
    codigoCuponPeor = cupon?.codigo ?? null;
  } else {
    const { data: codigo, error } = await supabaseAdmin.rpc('finalizar_jornada_atomica', {
      p_jornada_id: jornada_id,
      p_usuario_cupon: peor?.usuarioId ?? null,
      p_correo_cupon: quinielaPeor?.correo_contacto ?? null,
    });
    if (error) throw error;
    codigoCuponPeor = codigo ?? null;
  }

  // Los correos son best-effort y se registran por destinatario: se pueden reintentar sin duplicar.
  const avisos = [];
  async function avisar(etiqueta, clave, preparar) {
    try {
      const correo = await preparar();
      if (!correo) return;
      const enviado = await enviarAvisoUnico(supabaseAdmin, `cierre:${jornada_id}:${clave}`, correo);
      if (!enviado) avisos.push(`${etiqueta}: envío en curso`);
    } catch (e) {
      console.error(`cerrar-jornada (${jornada_id}) — falló ${etiqueta}:`, e.message);
      avisos.push(`${etiqueta}: ${e.message}`);
    }
  }

  const nombreJornada = escaparHtml(jornada.nombre ?? 'la jornada');

  if (codigoCuponPeor && quinielaPeor?.correo_contacto) {
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
      const { data: quinielaGanadora, error } = await supabaseAdmin.from('quinielas').select('alias, correo_contacto').eq('id', ganador.quinielaId).single();
      if (error) throw error;
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
      const { data: perfil } = await supabaseAdmin.from('perfiles').select('nombre_completo').eq('id', participante.usuario_id).single();
      const { data: authUser, error } = await supabaseAdmin.auth.admin.getUserById(participante.usuario_id);
      if (error) throw error;
      const correo = authUser?.user?.email;
      if (!correo) return null;

      let extra = '';
      if (gano) extra += `<p>🏆 ¡Felicidades! Ganaste $${gano.montoPremio.toFixed(2)} de premio.</p>`;
      if (ganoCupon) extra += `<p>🎟️ Te ganaste un cupón "Por tarugo" gratis para tu próximo registro. Código: <b>${escaparHtml(codigoCuponPeor)}</b></p>`;

      return {
        to: correo,
        subject: `Resultado final: ${jornada.nombre ?? 'tu jornada'}`,
        heading: `Resultado de ${nombreJornada}`,
        bodyHtml: `<p>Hola ${escaparHtml(perfil?.nombre_completo ?? '')}, tu quiniela "${escaparHtml(participante.alias ?? 'Entrada')}" obtuvo <b>${participante.aciertos} aciertos</b> y quedó en la posición <b>${participante.posicion}</b>.</p>${extra}`,
      };
    });
  }

  return {
    cuerpo: { status: 'ok', ganadores, peor, cuponGenerado: Boolean(codigoCuponPeor), avisos: avisos.length ? avisos : undefined },
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
