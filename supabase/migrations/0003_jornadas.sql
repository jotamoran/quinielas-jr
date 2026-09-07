CREATE TABLE jornadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  costo NUMERIC(10,2) NOT NULL DEFAULT 0,
  premio NUMERIC(10,2),
  fecha_cierre TIMESTAMPTZ NOT NULL,
  estatus TEXT DEFAULT 'activa' CHECK (estatus IN ('activa','cerrada','finalizada')),
  creado_por UUID REFERENCES perfiles(id),
  creado_el TIMESTAMPTZ DEFAULT NOW()
);
