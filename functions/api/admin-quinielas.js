import handler from '../../api/admin-quinielas.js';
import { vercelAdapter } from '../_lib/vercelAdapter.js';

export const onRequest = vercelAdapter(handler);
