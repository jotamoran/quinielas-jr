-- Regresión: un usuario autenticado NO debe poder insertar una quiniela propia
-- con estatus_pago='aprobado' (o aciertos != 0), saltándose la aprobación admin.
DO $$
DECLARE
  v_usuario UUID := gen_random_uuid();
  v_jornada UUID;
  v_fallo BOOLEAN := false;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_usuario, 'insertcheck@example.com');
  INSERT INTO jornadas (nombre, costo, fecha_cierre) VALUES ('Insert Check', 50, NOW() + interval '1 day') RETURNING id INTO v_jornada;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usuario::text)::text, true);

  BEGIN
    INSERT INTO quinielas (usuario_id, jornada_id, estatus_pago)
    VALUES (v_usuario, v_jornada, 'aprobado');
    -- Si llegamos aquí, el INSERT malicioso NO fue bloqueado: falla el test.
    v_fallo := true;
  EXCEPTION WHEN OTHERS THEN
    -- Esperado: la policy debe rechazar el INSERT.
    NULL;
  END;

  RESET ROLE;

  IF v_fallo THEN
    RAISE EXCEPTION 'FALLO: un usuario pudo auto-aprobar su quiniela vía INSERT (estatus_pago=aprobado)';
  END IF;

  -- Verificación adicional: no debe existir ninguna fila (ni pendiente ni aprobada)
  -- para ese usuario/jornada, ya que el INSERT completo debió ser rechazado.
  IF EXISTS (SELECT 1 FROM quinielas WHERE usuario_id = v_usuario AND jornada_id = v_jornada) THEN
    RAISE EXCEPTION 'FALLO: se insertó una fila de quiniela pese al rechazo esperado de la policy';
  END IF;

  RAISE NOTICE 'OK: quinielas_insert_check.test.sql';
END $$;
