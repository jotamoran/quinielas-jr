import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

const ESTATUS = new Set(['pendiente', 'aprobado', 'rechazado']);
const PRONOSTICOS = new Set(['L', 'E', 'V']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizarCorreo(correo) {
  const valor = correo?.trim();
  if (!valor) return null;
  if (!EMAIL_REGEX.test(valor)) throw new ErrorHttp(400, 'El correo de contacto no es válido');
  return valor;
}

export default async function handler(req, res) {
  try {
    const { user } = await requireAdmin(req);
    const supabase = getSupabaseAdmin();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('quinielas')
        .select('id, usuario_id, jornada_id, alias, correo_contacto, estatus_pago, metodo_pago, monto_pagado, aciertos, creado_el, origen, jornadas(nombre, costo), perfiles!quinielas_usuario_id_fkey(nombre_completo)')
        .order('creado_el', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ quinielas: data ?? [] });
    }

    if (req.method === 'POST') {
      const { jornada_id: jornadaId, alias, correo_contacto: correoContactoRaw, estatus_pago: estatus, predicciones } = req.body ?? {};
      if (!jornadaId || !alias?.trim() || !ESTATUS.has(estatus) || !Array.isArray(predicciones)) {
        return res.status(400).json({ error: 'Completa la entrada, el estatus y los pronósticos' });
      }
      const correoContacto = normalizarCorreo(correoContactoRaw);

      const { data: jornada, error: jornadaError } = await supabase.from('jornadas').select('id, costo, fecha_cierre, estatus').eq('id', jornadaId).single();
      if (jornadaError) throw jornadaError;
      if (jornada.estatus !== 'activa' || new Date(jornada.fecha_cierre) <= new Date()) return res.status(409).json({ error: 'La jornada ya no admite quinielas' });

      const { data: partidosActivos, error: partidosError } = await supabase.from('partidos').select('id').eq('jornada_id', jornadaId).eq('cancelado', false);
      if (partidosError) throw partidosError;
      const idsActivos = new Set(partidosActivos.map((p) => p.id));

      if (predicciones.length !== idsActivos.size) {
        return res.status(400).json({ error: `Completa los ${idsActivos.size} pronósticos` });
      }
      if (new Set(predicciones.map((item) => item.partido_id)).size !== idsActivos.size || predicciones.some((item) => !PRONOSTICOS.has(item.pronostico) || !idsActivos.has(item.partido_id))) {
        return res.status(400).json({ error: 'Los pronósticos no son válidos' });
      }

      const pagada = estatus === 'aprobado';
      const { data: quiniela, error: quinielaError } = await supabase.from('quinielas').insert({
        usuario_id: null,
        jornada_id: jornadaId,
        alias: alias.trim(),
        correo_contacto: correoContacto,
        estatus_pago: estatus,
        metodo_pago: 'efectivo',
        monto_pagado: pagada ? jornada.costo : 0,
        revisado_por: pagada ? user.id : null,
        revisado_el: pagada ? new Date().toISOString() : null,
        origen: 'manual_admin',
      }).select().single();
      if (quinielaError) throw quinielaError;

      const rows = predicciones.map((item) => ({ quiniela_id: quiniela.id, partido_id: item.partido_id, pronostico: item.pronostico }));
      const { error: predictionError } = await supabase.from('predicciones').insert(rows);
      if (predictionError) {
        await supabase.from('quinielas').delete().eq('id', quiniela.id);
        throw predictionError;
      }
      return res.status(201).json({ quiniela });
    }

    if (req.method === 'PATCH') {
      const { quiniela_id: quinielaId, alias, correo_contacto: correoContactoRaw, estatus_pago: estatus } = req.body ?? {};
      if (!quinielaId || !alias?.trim() || !ESTATUS.has(estatus)) return res.status(400).json({ error: 'Los datos de la quiniela no son válidos' });
      const correoContacto = normalizarCorreo(correoContactoRaw);
      const { data: actual, error: actualError } = await supabase.from('quinielas').select('monto_pagado, jornadas(costo)').eq('id', quinielaId).single();
      if (actualError) throw actualError;
      const update = {
        alias: alias.trim(),
        correo_contacto: correoContacto,
        estatus_pago: estatus,
        monto_pagado: estatus === 'aprobado' ? (actual.monto_pagado || actual.jornadas?.costo || 0) : actual.monto_pagado,
        revisado_por: user.id,
        revisado_el: new Date().toISOString(),
      };
      const { error } = await supabase.from('quinielas').update(update).eq('id', quinielaId);
      if (error) throw error;
      return res.status(200).json({ status: 'ok' });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    const status = error instanceof ErrorHttp ? error.status : 500;
    return res.status(status).json({ error: error.message });
  }
}
