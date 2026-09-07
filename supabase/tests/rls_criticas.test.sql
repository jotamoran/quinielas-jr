DO $$
DECLARE
  v_usuario_a UUID := gen_random_uuid();
  v_usuario_b UUID := gen_random_uuid();
  v_jornada_abierta UUID;
  v_jornada_cerrada UUID;
  v_partido UUID;
  v_quiniela UUID;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_usuario_a, 'a@example.com'), (v_usuario_b, 'b@example.com');

  INSERT INTO jornadas (nombre, costo, fecha_cierre) VALUES ('Abierta', 50, NOW() + interval '1 day') RETURNING id INTO v_jornada_abierta;
  INSERT INTO jornadas (nombre, costo, fecha_cierre) VALUES ('Cerrada', 50, NOW() - interval '1 day') RETURNING id INTO v_jornada_cerrada;
  INSERT INTO partidos (jornada_id, api_league_id, equipo_local, equipo_visitante, fecha_partido)
  VALUES (v_jornada_abierta, 262, 'A', 'B', NOW()) RETURNING id INTO v_partido;

  INSERT INTO quinielas (usuario_id, jornada_id) VALUES (v_usuario_a, v_jornada_abierta) RETURNING id INTO v_quiniela;

  -- Simular request del usuario A
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usuario_a::text)::text, true);

  -- Debe poder insertar su propia predicción en jornada abierta
  BEGIN
    INSERT INTO predicciones (quiniela_id, partido_id, pronostico) VALUES (v_quiniela, v_partido, 'L');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FALLO: usuario A debería poder registrar su predicción en jornada abierta';
  END;

  -- Simular request del usuario B: no debe poder ver la quiniela de A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usuario_b::text)::text, true);
  IF EXISTS (SELECT 1 FROM quinielas WHERE id = v_quiniela) THEN
    RAISE EXCEPTION 'FALLO: usuario B no debería poder ver la quiniela de A';
  END IF;

  RESET ROLE;
  RAISE NOTICE 'OK: rls_criticas.test.sql';
END $$;
