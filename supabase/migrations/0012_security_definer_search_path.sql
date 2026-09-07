-- Hardening: fija search_path en funciones SECURITY DEFINER para evitar
-- ataques de "search_path hijacking" (esquemas maliciosos antepuestos en el path).
ALTER FUNCTION handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION es_admin() SET search_path = public, pg_temp;
ALTER FUNCTION calcular_puntos(UUID) SET search_path = public, pg_temp;
