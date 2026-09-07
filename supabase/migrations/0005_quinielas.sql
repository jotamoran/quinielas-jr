CREATE TABLE quinielas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE CASCADE,
  alias TEXT,
  estatus_pago TEXT DEFAULT 'pendiente' CHECK (estatus_pago IN ('pendiente','aprobado','rechazado')),
  metodo_pago TEXT CHECK (metodo_pago IN ('transferencia','efectivo','cupon')),
  monto_pagado NUMERIC(10,2),
  comprobante_url TEXT,
  revisado_por UUID REFERENCES perfiles(id),
  revisado_el TIMESTAMPTZ,
  aciertos INT DEFAULT 0,
  creado_el TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_quinielas_jornada ON quinielas(jornada_id);
CREATE INDEX idx_quinielas_usuario ON quinielas(usuario_id);
