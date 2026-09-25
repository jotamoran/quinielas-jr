import handler from '../../../api/_lib/routes/username-disponible.js';
import { vercelAdapter } from '../../_lib/vercelAdapter.js';

export const onRequest = vercelAdapter(handler);
