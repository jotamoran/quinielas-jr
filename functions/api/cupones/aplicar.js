import handler from '../../../api/cupones/aplicar.js';
import { vercelAdapter } from '../../_lib/vercelAdapter.js';

export const onRequest = vercelAdapter(handler);
