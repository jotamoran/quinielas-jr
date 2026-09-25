import handler from '../../api/sync-results.js';
import { vercelAdapter } from '../_lib/vercelAdapter.js';

export const onRequest = vercelAdapter(handler);
