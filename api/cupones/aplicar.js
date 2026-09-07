import { requireUser, ErrorHttp } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  try {
    const { user } = await requireUser(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { codigo, quiniela_id } = req.body;
    if (!codigo || !quiniela_id) return res.status(400).json({ error: 'Faltan codigo o quiniela_id' });

    const supabaseAdmin = getSupabaseAdmin();

    const { data: cupon } = await supabaseAdmin
      .from('cupones')
      .select('id, estatus, usuario_id')
      .eq('codigo', codigo)
      .single();

    if (!cupon || cupon.usuario_id !== user.id || cupon.estatus !== 'activo') {
      return res.status(400).json({ error: 'Cupón inválido o ya utilizado' });
    }

    const { data: quiniela } = await supabaseAdmin.from('quinielas').select('usuario_id').eq('id', quiniela_id).single();
    if (!quiniela || quiniela.usuario_id !== user.id) {
      return res.status(403).json({ error: 'La quiniela no te pertenece' });
    }

    const { error: errorAprobarQuiniela } = await supabaseAdmin.from('quinielas').update({
      estatus_pago: 'aprobado',
      metodo_pago: 'cupon',
      monto_pagado: 0,
    }).eq('id', quiniela_id);
    if (errorAprobarQuiniela) throw errorAprobarQuiniela;

    const { error: errorMarcarCuponUsado } = await supabaseAdmin.from('cupones').update({
      estatus: 'usado',
      usado_en_quiniela_id: quiniela_id,
      usado_el: new Date().toISOString(),
    }).eq('id', cupon.id);
    if (errorMarcarCuponUsado) throw errorMarcarCuponUsado;

    return res.status(200).json({ status: 'ok' });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
