import { createClient } from '@supabase/supabase-js';

let cliente;

export function getSupabaseAdmin() {
  if (!cliente) {
    cliente = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return cliente;
}
