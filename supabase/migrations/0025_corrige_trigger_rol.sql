-- Corrige un error de la migración 0024: el trigger prevenir_cambio_de_rol()
-- usaba es_admin(), que depende de auth.uid() — NULL fuera de una sesión de
-- usuario autenticada. Eso bloqueaba también los cambios de rol hechos con
-- la llave de servicio o desde el SQL Editor (verificado en vivo: ambos
-- casos fallaban con "No autorizado para cambiar el rol"), dejando sin
-- forma de crear un segundo admin en el futuro.
--
-- La corrección: solo bloquear cuando la petición viene de una sesión
-- autenticada normal (auth.role() = 'authenticated', el caso real que se
-- quería prevenir: un usuario común promoviéndose a sí mismo). Las
-- llamadas con la llave de servicio (auth.role() = 'service_role') y las
-- corridas directas en el SQL Editor (sin contexto de JWT, auth.role() es
-- NULL) quedan exentas, igual que ya pasa en el resto de las políticas RLS
-- de este proyecto.
CREATE OR REPLACE FUNCTION prevenir_cambio_de_rol()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol IS DISTINCT FROM OLD.rol
     AND auth.role() = 'authenticated'
     AND NOT es_admin() THEN
    RAISE EXCEPTION 'No autorizado para cambiar el rol';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
