import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { calcularGanadoresYPeor } from './_lib/premios.js';
import { enviarCorreo } from './_lib/email.js';

function generarCodigoCupon() {
  return 'QNL-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

const CODIGO_UNIQUE_VIOLATION = '23505';

async function insertarCuponConReintento(supabaseAdmin, { usuarioId, correoContacto, jornadaId }, intentosMax = 3) {
  for (let intento = 1; intento <= intentosMax; intento++) {
    const codigo = generarCodigoCupon();
    const { error } = await supabaseAdmin.from('cupones').insert({
      codigo,
      usuario_id: usuarioId ?? null,
      correo_contacto: correoContacto ?? null,
      jornada_origen_id: jornadaId,
    });
    if (!error) return codigo;
    const esColisionDeCodigo = error.code === CODIGO_UNIQUE_VIOLATION;
    if (!esColisionDeCodigo || intento === intentosMax) throw error;
  }
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { jornada_id } = req.body;
    if (!jornada_id) return res.status(400).json({ error: 'Falta jornada_id' });

    const supabaseAdmin = getSupabaseAdmin();

    const { data: jornadaActual, error: errorJornadaActual } = await supabaseAdmin.from('jornadas').select('estatus').eq('id', jornada_id).single();
    if (errorJornadaActual) throw errorJornadaActual;
    if (!jornadaActual) return res.status(404).json({ error: 'La jornada no existe' });
    if (jornadaActual.estatus === 'finalizada') return res.status(409).json({ error: 'Esta jornada ya fue finalizada' });

    const { count: resultadosPendientes, error: errorResultados } = await supabaseAdmin
      .from('partidos')
      .select('id', { count: 'exact', head: true })
      .eq('jornada_id', jornada_id)
      .is('resultado_oficial', null);
    if (errorResultados) throw errorResultados;
    if (resultadosPendientes > 0) {
      return res.status(409).json({ error: `Faltan ${resultadosPendientes} resultado(s) oficiales` });
    }

    const { data: jornada } = await supabaseAdmin.from('jornadas').select('nombre, premio').eq('id', jornada_id).single();
    const { data: ranking, error } = await supabaseAdmin
      .from('vista_ranking_jornada')
      .select('quiniela_id, usuario_id, nombre_completo, alias, aciertos, posicion')
      .eq('jornada_id', jornada_id);
    if (error) throw error;
    if (!ranking || ranking.length === 0) return res.status(400).json({ error: 'No hay quinielas aprobadas en esta jornada' });

    const entradas = ranking.map((r) => ({ quinielaId: r.quiniela_id, usuarioId: r.usuario_id, aciertos: r.aciertos }));
    const { ganadores, peor } = calcularGanadoresYPeor(entradas, jornada?.premio ?? null);

    // Cerrar la jornada es lo importante y no puede depender de que los correos
    // salgan: si el SMTP falla, el aviso queda pendiente pero la jornada sí cierra.
    const { error: errorFinalizarJornada } = await supabaseAdmin.from('jornadas').update({ estatus: 'finalizada' }).eq('id', jornada_id);
    if (errorFinalizarJornada) throw errorFinalizarJornada;

    const avisos = [];
    async function intentar(etiqueta, fn) {
      try {
        await fn();
      } catch (e) {
        console.error(`cerrar-jornada (${jornada_id}) — falló ${etiqueta}:`, e.message);
        avisos.push(`${etiqueta}: ${e.message}`);
      }
    }

    let codigoCuponPeor = null;
    if (peor?.usuarioId) {
      await intentar('generar cupón "Por tarugo"', async () => {
        codigoCuponPeor = await insertarCuponConReintento(supabaseAdmin, { usuarioId: peor.usuarioId, jornadaId: jornada_id });
      });
    } else if (peor) {
      const { data: quinielaPeor } = await supabaseAdmin.from('quinielas').select('alias, correo_contacto').eq('id', peor.quinielaId).single();
      if (quinielaPeor?.correo_contacto) {
        await intentar('cupón "Por tarugo" por correo de contacto', async () => {
          codigoCuponPeor = await insertarCuponConReintento(supabaseAdmin, { correoContacto: quinielaPeor.correo_contacto, jornadaId: jornada_id });
          await enviarCorreo({
            to: quinielaPeor.correo_contacto,
            subject: `Tu cupón "Por tarugo" de ${jornada?.nombre ?? 'la jornada'}`,
            heading: '🎟️ Ganaste un cupón "Por tarugo"',
            bodyHtml: `<p>Hola, tu quiniela "${quinielaPeor.alias ?? 'Entrada'}" fue la que menos aciertos tuvo en <b>${jornada?.nombre ?? 'la jornada'}</b>, así que te ganaste un cupón de consolación para tu próximo registro.</p><p>Código: <b>${codigoCuponPeor}</b></p><p>Preséntalo con quien te registró para usarlo en tu siguiente quiniela.</p>`,
          });
        });
      }
    }

    // Ganadores de premio sin cuenta (registro presencial) pero con correo de
    // contacto capturado — hasta ahora solo el cupón "Por tarugo" avisaba por
    // esta vía; el premio principal es al menos igual de importante avisar.
    for (const ganador of ganadores) {
      if (ganador.usuarioId) continue; // ya se maneja abajo, junto con su correo de cuenta
      await intentar(`correo de premio (sin cuenta) a quiniela ${ganador.quinielaId}`, async () => {
        const { data: quinielaGanadora } = await supabaseAdmin.from('quinielas').select('alias, correo_contacto').eq('id', ganador.quinielaId).single();
        if (!quinielaGanadora?.correo_contacto) return;
        await enviarCorreo({
          to: quinielaGanadora.correo_contacto,
          subject: `¡Ganaste! ${jornada?.nombre ?? 'Resultado final'}`,
          heading: '🏆 ¡Felicidades, ganaste el premio!',
          bodyHtml: `<p>Hola, tu quiniela "${quinielaGanadora.alias ?? 'Entrada'}" ganó <b>$${ganador.montoPremio.toFixed(2)}</b> de premio en <b>${jornada?.nombre ?? 'la jornada'}</b>.</p><p>Contacta a quien te registró para que te haga llegar tu premio.</p>`,
        });
      });
    }

    for (const participante of ranking) {
      if (!participante.usuario_id) continue;

      const gano = ganadores.find((g) => g.quinielaId === participante.quiniela_id);
      const esPeor = peor?.quinielaId === participante.quiniela_id;
      const ganoCupon = esPeor && codigoCuponPeor;
      if (!gano && !ganoCupon) continue; // no ganó premio ni cupón: no le mandamos correo

      const { data: perfil } = await supabaseAdmin.from('perfiles').select('nombre_completo').eq('id', participante.usuario_id).single();
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(participante.usuario_id);
      const correo = authUser?.user?.email;
      if (!correo) continue;

      let extra = '';
      if (gano) extra += `<p>🏆 ¡Felicidades! Ganaste $${gano.montoPremio.toFixed(2)} de premio.</p>`;
      if (ganoCupon) extra += `<p>🎟️ Te ganaste un cupón "Por tarugo" gratis para tu próximo registro. Código: <b>${codigoCuponPeor}</b></p>`;

      await intentar(`correo a ${correo}`, () => enviarCorreo({
        to: correo,
        subject: `Resultado final: ${jornada?.nombre ?? 'tu jornada'}`,
        heading: `Resultado de ${jornada?.nombre ?? 'la jornada'}`,
        bodyHtml: `<p>Hola ${perfil?.nombre_completo ?? ''}, tu quiniela "${participante.alias ?? 'Entrada'}" obtuvo <b>${participante.aciertos} aciertos</b> y quedó en la posición <b>${participante.posicion}</b>.</p>${extra}`,
      }));
    }

    return res.status(200).json({ status: 'ok', ganadores, peor, avisos: avisos.length ? avisos : undefined });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
