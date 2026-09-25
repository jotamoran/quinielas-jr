import handler from '../../api/auth/index.js';
import { vercelAdapter } from '../_lib/vercelAdapter.js';

export const onRequest = vercelAdapter(handler);
