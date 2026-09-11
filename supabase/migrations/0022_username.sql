-- supabase/migrations/0022_username.sql
ALTER TABLE perfiles ADD COLUMN username TEXT;

WITH candidatos AS (
  SELECT
    perfil.id,
    LOWER(usuario.raw_user_meta_data->>'username') AS username,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(usuario.raw_user_meta_data->>'username')
      ORDER BY perfil.creado_el, perfil.id
    ) AS posicion
  FROM perfiles AS perfil
  JOIN auth.users AS usuario ON usuario.id = perfil.id
  WHERE perfil.username IS NULL
    AND LOWER(usuario.raw_user_meta_data->>'username') ~ '^[a-z0-9_]{3,20}$'
)
UPDATE perfiles AS perfil
SET username = candidato.username
FROM candidatos AS candidato
WHERE perfil.id = candidato.id
  AND candidato.posicion = 1
  AND NOT EXISTS (
    SELECT 1 FROM perfiles AS existente
    WHERE existente.username = candidato.username
  );

WITH perfiles_sin_username AS (
  SELECT
    id,
    rol,
    ROW_NUMBER() OVER (PARTITION BY rol ORDER BY creado_el, id) AS posicion
  FROM perfiles
  WHERE username IS NULL
)
UPDATE perfiles AS perfil
SET username = CASE
  WHEN pendiente.rol = 'admin' AND pendiente.posicion = 1
    AND NOT EXISTS (SELECT 1 FROM perfiles WHERE username = 'admin') THEN 'admin'
  WHEN pendiente.rol = 'admin' THEN 'admin_' || SUBSTRING(REPLACE(pendiente.id::TEXT, '-', ''), 1, 14)
  ELSE 'usuario_' || SUBSTRING(REPLACE(pendiente.id::TEXT, '-', ''), 1, 12)
END
FROM perfiles_sin_username AS pendiente
WHERE perfil.id = pendiente.id;

ALTER TABLE perfiles
  ALTER COLUMN username SET NOT NULL,
  ADD CONSTRAINT perfiles_username_formato CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  ADD CONSTRAINT perfiles_username_unico UNIQUE (username);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfiles (id, nombre_completo, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email), NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
