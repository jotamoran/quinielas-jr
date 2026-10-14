import cancelarJornada from './_lib/routes/cancelar-jornada.js';
import cerrarJornada from './_lib/routes/cerrar-jornada.js';
import cierreAutomatico from './_lib/routes/cierre-automatico.js';
import recordatorioPremio from './_lib/routes/recordatorio-premio.js';

export default function handler(req, res) {
  if (req.query?.action === 'cancelar') return cancelarJornada(req, res);
  if (req.query?.action === 'cerrar') return cerrarJornada(req, res);
  if (req.query?.action === 'cierre-automatico') return cierreAutomatico(req, res);
  if (req.query?.action === 'recordatorio-premio') return recordatorioPremio(req, res);
  return res.status(404).json({ error: 'Acción no encontrada' });
}
