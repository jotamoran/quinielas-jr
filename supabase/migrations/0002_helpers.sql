CREATE OR REPLACE FUNCTION es_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
