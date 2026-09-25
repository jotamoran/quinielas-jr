import handler from '../../api/manual-results.js';
import { vercelAdapter } from '../_lib/vercelAdapter.js';

export const onRequest = vercelAdapter(handler);
