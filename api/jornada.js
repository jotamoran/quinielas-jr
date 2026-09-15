import cancelarJornada from './_lib/routes/cancelar-jornada.js';
import cerrarJornada from './_lib/routes/cerrar-jornada.js';

export default function handler(req, res) {
  if (req.query?.action === 'cancelar') return cancelarJornada(req, res);
  if (req.query?.action === 'cerrar') return cerrarJornada(req, res);
  return res.status(404).json({ error: 'Acción no encontrada' });
}
