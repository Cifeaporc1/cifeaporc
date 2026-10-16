-- =====================================================================
-- CIFEAPORC · Dar rol de profesor a una cuenta
-- 1) Antes, crea la cuenta en Supabase → Authentication → Users →
--    Add user → Create new user (tu correo y una contraseña, marca
--    "Auto Confirm User").
-- 2) Cambia el correo y el alias de abajo y pulsa Run.
-- Repite con cada profesor que quieras añadir.
-- =====================================================================

insert into public.perfiles (user_id, alias, rol, granja_id)
select id, 'Prof. Luis', 'profesor', null
from auth.users
where email = 'CAMBIA-ESTE-CORREO@ejemplo.com';
