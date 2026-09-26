-- Respaldo reproducible del esquema de Quinielas JR.
-- Ejecutar con psql desde la carpeta supabase:
-- psql "$DATABASE_URL" -f bootstrap-manual.sql
--
-- Este archivo aplica las migraciones en orden. No contiene usuarios de Auth
-- ni datos de las tablas; esos requieren un respaldo separado.

\set ON_ERROR_STOP on

\ir migrations/0001_perfiles.sql
\ir migrations/0002_helpers.sql
\ir migrations/0003_jornadas.sql
\ir migrations/0004_partidos.sql
\ir migrations/0005_quinielas.sql
\ir migrations/0006_predicciones.sql
\ir migrations/0007_cupones.sql
\ir migrations/0008_calcular_puntos.sql
\ir migrations/0009_vistas_ranking.sql
\ir migrations/0010_rls.sql
\ir migrations/0011_fix_quinielas_insert_check.sql
\ir migrations/0012_security_definer_search_path.sql
\ir migrations/0013_football_provider_and_nine_matches.sql
\ir migrations/0014_quinielas_presenciales.sql
\ir migrations/0015_cierre_y_pronosticos_publicos.sql
\ir migrations/0016_partidos_reutilizables.sql
\ir migrations/0017_correo_contacto_manual.sql
\ir migrations/0018_equipos_cache.sql
\ir migrations/0019_vista_jornada_publica.sql
\ir migrations/0020_cancelar_partido.sql
\ir migrations/0021_integridad_cierre_jornada.sql
\ir migrations/0022_username.sql
\ir migrations/0023_cancelar_jornada.sql
\ir migrations/0024_seguridad_estatus_y_rol.sql
\ir migrations/0025_corrige_trigger_rol.sql
\ir migrations/0026_datos_bancarios.sql
\ir migrations/0027_bloquear_jornadas_finalizadas.sql
\ir migrations/0028_estado_marcador_partidos.sql
\ir migrations/0029_registro_atomico_y_restricciones.sql
\ir migrations/0030_integridad_operativa.sql
\ir migrations/0031_consolida_validacion_predicciones.sql
\ir migrations/0032_pagos_transferencia_agrupados.sql
\ir migrations/0033_ranking_publico_en_vivo.sql
