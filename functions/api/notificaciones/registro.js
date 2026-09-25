import handler from '../../../api/notificaciones/registro.js';
import { vercelAdapter } from '../../_lib/vercelAdapter.js';

export const onRequest = vercelAdapter(handler);
