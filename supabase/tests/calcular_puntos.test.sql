DO $$
DECLARE
  v_jornada UUID;
  v_usuario UUID := gen_random_uuid();
  v_p1 UUID; v_p2 UUID; v_p3 UUID; v_p4 UUID;
  v_q1 UUID; v_q2 UUID;
  v_aciertos_q1 INT; v_aciertos_q2 INT;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_usuario, 'jugador@example.com');

  INSERT INTO jornadas (nombre, costo, fecha_cierre)
  VALUES ('Jornada de prueba', 50, NOW() + interval '1 day')
  RETURNING id INTO v_jornada;

  INSERT INTO partidos (jornada_id, api_league_id, equipo_local, equipo_visitante, fecha_partido, resultado_oficial)
  VALUES
    (v_jornada, 262, 'América', 'Chivas', NOW(), 'L') RETURNING id INTO v_p1;
  INSERT INTO partidos (jornada_id, api_league_id, equipo_local, equipo_visitante, fecha_partido, resultado_oficial)
  VALUES
    (v_jornada, 262, 'Cruz Azul', 'Pumas', NOW(), 'E') RETURNING id INTO v_p2;
  INSERT INTO partidos (jornada_id, api_league_id, equipo_local, equipo_visitante, fecha_partido, resultado_oficial)
  VALUES
    (v_jornada, 262, 'Monterrey', 'Tigres', NOW(), NULL) RETURNING id INTO v_p3; -- aún sin resultado
  INSERT INTO partidos (jornada_id, api_league_id, equipo_local, equipo_visitante, fecha_partido, resultado_oficial, cancelado)
  VALUES
    (v_jornada, 262, 'Toluca', 'León', NOW(), 'L', true) RETURNING id INTO v_p4; -- cancelado, con resultado cargado por error

  -- Quiniela 1: acierta p1 y p2, p3 sin resultado aún, p4 cancelado (aunque el pronóstico coincide con el resultado no debe contar) -> 2 aciertos
  INSERT INTO quinielas (usuario_id, jornada_id, estatus_pago) VALUES (v_usuario, v_jornada, 'aprobado') RETURNING id INTO v_q1;
  INSERT INTO predicciones (quiniela_id, partido_id, pronostico) VALUES (v_q1, v_p1, 'L'), (v_q1, v_p2, 'E'), (v_q1, v_p3, 'V'), (v_q1, v_p4, 'L');

  -- Quiniela 2: solo acierta p1, no pronostica p4 -> 1 acierto
  INSERT INTO quinielas (usuario_id, jornada_id, estatus_pago) VALUES (v_usuario, v_jornada, 'aprobado') RETURNING id INTO v_q2;
  INSERT INTO predicciones (quiniela_id, partido_id, pronostico) VALUES (v_q2, v_p1, 'L'), (v_q2, v_p2, 'V'), (v_q2, v_p3, 'L');

  PERFORM calcular_puntos(v_jornada);

  SELECT aciertos INTO v_aciertos_q1 FROM quinielas WHERE id = v_q1;
  SELECT aciertos INTO v_aciertos_q2 FROM quinielas WHERE id = v_q2;

  IF v_aciertos_q1 != 2 THEN
    RAISE EXCEPTION 'FALLO: quiniela 1 debería tener 2 aciertos (p4 cancelado no debe contar aunque coincida), tiene %', v_aciertos_q1;
  END IF;
  IF v_aciertos_q2 != 1 THEN
    RAISE EXCEPTION 'FALLO: quiniela 2 debería tener 1 acierto, tiene %', v_aciertos_q2;
  END IF;

  RAISE NOTICE 'OK: calcular_puntos.test.sql';
END $$;
