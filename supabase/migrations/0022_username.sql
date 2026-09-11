-- supabase/migrations/0022_username.sql
ALTER TABLE perfiles ADD COLUMN username TEXT;

UPDATE perfiles SET username = 'admin' WHERE rol = 'admin' AND username IS NULL;

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
