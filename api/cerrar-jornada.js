import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { calcularGanadoresYPeor } from './_lib/premios.js';
import { enviarCorreo } from './_lib/email.js';

function generarCodigoCupon() {
  return 'QNL-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

const CODIGO_UNIQUE_VIOLATION = '23505';

async function insertarCuponConReintento(supabaseAdmin, { usuarioId, jornadaId }, intentosMax = 3) {
  for (let intento = 1; intento <= intentosMax; intento++) {
    const { error } = await supabaseAdmin.from('cupones').insert({
      codigo: generarCodigoCupon(),
      usuario_id: usuarioId,
      jornada_origen_id: jornadaId,
    });
    if (!error) return;
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

    if (peor?.usuarioId) {
      await insertarCuponConReintento(supabaseAdmin, { usuarioId: peor.usuarioId, jornadaId: jornada_id });
    }

    const { error: errorFinalizarJornada } = await supabaseAdmin.from('jornadas').update({ estatus: 'finalizada' }).eq('id', jornada_id);
    if (errorFinalizarJornada) throw errorFinalizarJornada;

    for (const participante of ranking) {
      if (!participante.usuario_id) continue;
      const { data: perfil } = await supabaseAdmin.from('perfiles').select('nombre_completo').eq('id', participante.usuario_id).single();
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(participante.usuario_id);
      const correo = authUser?.user?.email;
      if (!correo) continue;

      const gano = ganadores.find((g) => g.quinielaId === participante.quiniela_id);
      const esPeor = peor?.quinielaId === participante.quiniela_id;

      let extra = '';
      if (gano) extra += `<p>🏆 ¡Felicidades! Ganaste $${gano.montoPremio.toFixed(2)} de premio.</p>`;
      if (esPeor) extra += `<p>🎟️ Te regalamos un cupón de quiniela gratis para tu próximo registro.</p>`;

      await enviarCorreo({
        to: correo,
        subject: `Resultado final: ${jornada?.nombre ?? 'tu jornada'}`,
        heading: `Resultado de ${jornada?.nombre ?? 'la jornada'}`,
        bodyHtml: `<p>Hola ${perfil?.nombre_completo ?? ''}, tu quiniela "${participante.alias ?? 'Entrada'}" obtuvo <b>${participante.aciertos} aciertos</b> y quedó en la posición <b>${participante.posicion}</b>.</p>${extra}`,
      });
    }

    return res.status(200).json({ status: 'ok', ganadores, peor });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
