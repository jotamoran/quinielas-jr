import handler from '../../../api/_lib/routes/iniciar-sesion.js';
import { vercelAdapter } from '../../_lib/vercelAdapter.js';

export const onRequest = vercelAdapter(handler);
