CREATE TABLE cupones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  jornada_origen_id UUID REFERENCES jornadas(id),
  estatus TEXT DEFAULT 'activo' CHECK (estatus IN ('activo','usado','cancelado')),
  usado_en_quiniela_id UUID REFERENCES quinielas(id),
  creado_el TIMESTAMPTZ DEFAULT NOW(),
  usado_el TIMESTAMPTZ
);
