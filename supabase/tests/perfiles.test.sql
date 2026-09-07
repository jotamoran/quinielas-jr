-- Verifica que insertar en auth.users crea automáticamente el perfil
DO $$
DECLARE
  nuevo_id UUID := gen_random_uuid();
  filas INT;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (nuevo_id, 'test@example.com', '{"nombre_completo":"Test User"}'::jsonb);

  SELECT COUNT(*) INTO filas FROM perfiles WHERE id = nuevo_id;
  IF filas != 1 THEN
    RAISE EXCEPTION 'FALLO: no se creó el perfil automáticamente (filas=%)', filas;
  END IF;

  IF (SELECT rol FROM perfiles WHERE id = nuevo_id) != 'usuario' THEN
    RAISE EXCEPTION 'FALLO: rol por default debería ser usuario';
  END IF;

  IF (SELECT nombre_completo FROM perfiles WHERE id = nuevo_id) != 'Test User' THEN
    RAISE EXCEPTION 'FALLO: nombre_completo no se copió del metadata';
  END IF;

  RAISE NOTICE 'OK: perfiles.test.sql';
END $$;
