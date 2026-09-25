import handler from '../../../api/_lib/routes/verificar-codigo.js';
import { vercelAdapter } from '../../_lib/vercelAdapter.js';

export const onRequest = vercelAdapter(handler);
