CREATE TABLE predicciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiniela_id UUID REFERENCES quinielas(id) ON DELETE CASCADE,
  partido_id UUID REFERENCES partidos(id) ON DELETE CASCADE,
  pronostico TEXT NOT NULL CHECK (pronostico IN ('L','E','V')),
  UNIQUE(quiniela_id, partido_id)
);
