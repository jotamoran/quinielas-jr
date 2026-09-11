-- supabase/migrations/0023_cancelar_jornada.sql
ALTER TABLE jornadas DROP CONSTRAINT jornadas_estatus_check;
ALTER TABLE jornadas ADD CONSTRAINT jornadas_estatus_check
  CHECK (estatus IN ('borrador', 'activa', 'cerrada', 'finalizada', 'cancelada'));
