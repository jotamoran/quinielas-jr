import handler from "../../../api/notificaciones/pago-transferencia.js";
import { vercelAdapter } from "../../_lib/vercelAdapter.js";

export const onRequest = vercelAdapter(handler);
