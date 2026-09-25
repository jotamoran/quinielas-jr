import handler from '../../api/_lib/routes/cancelar-jornada.js';
import { vercelAdapter } from '../_lib/vercelAdapter.js';

export const onRequest = vercelAdapter(handler);
