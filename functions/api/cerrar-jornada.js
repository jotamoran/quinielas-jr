import handler from '../../api/_lib/routes/cerrar-jornada.js';
import { vercelAdapter } from '../_lib/vercelAdapter.js';

export const onRequest = vercelAdapter(handler);
