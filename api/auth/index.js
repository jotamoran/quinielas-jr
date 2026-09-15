import iniciarSesion from '../_lib/routes/iniciar-sesion.js';
import usernameDisponible from '../_lib/routes/username-disponible.js';
import verificarCodigo from '../_lib/routes/verificar-codigo.js';

const acciones = { 'iniciar-sesion': iniciarSesion, 'username-disponible': usernameDisponible, 'verificar-codigo': verificarCodigo };

export default function handler(req, res) {
  const accion = acciones[req.query?.action];
  if (!accion) return res.status(404).json({ error: 'Acción no encontrada' });
  return accion(req, res);
}
