-- Permite capturar un correo de contacto opcional en quinielas registradas
-- de forma presencial (sin cuenta), para poder hacerles llegar el código
-- del cupón "Por tarugo" si resultan ser quienes menos aciertos tuvieron.
ALTER TABLE quinielas ADD COLUMN correo_contacto TEXT;

-- El cupón puede quedar asociado a un correo de contacto en vez de una
-- cuenta de usuario, cuando la quiniela ganadora del cupón es presencial.
ALTER TABLE cupones ADD COLUMN correo_contacto TEXT;
