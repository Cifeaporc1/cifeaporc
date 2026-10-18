-- =====================================================================
-- CIFEAPORC · Nombres de los alumnos (opcional)
-- Pegar entero en Supabase → SQL Editor → New query → Run. Repetible.
--
-- · El nombre es opcional y solo se muestra; se sigue entrando con alias + PIN.
-- · Cada alumno ve los nombres de SU granja (su curso); el profesor, todos.
-- · Los registros no copian el nombre: se consulta al mostrarlo. Al borrar
--   los nombres (cambio de curso), desaparecen de todo el historial.
-- =====================================================================

alter table public.perfiles add column if not exists nombre text;

-- Nombres que puede ver el usuario que pregunta (sin abrir la tabla de perfiles)
create or replace function public.nombres_visibles()
returns table (user_id uuid, alias text, nombre text, rol text, granja_id smallint)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.alias, p.nombre, p.rol, p.granja_id
  from perfiles p
  where public.tiene_acceso()
    and (public.es_profesor()
         or p.rol = 'profesor'
         or p.granja_id = public.mi_granja());
$$;
revoke all on function public.nombres_visibles() from public, anon;
grant execute on function public.nombres_visibles() to authenticated;

-- Fin de curso: desactiva a los alumnos y BORRA sus nombres.
create or replace function public.cerrar_curso()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.es_profesor() then
    raise exception 'Solo el profesor puede cerrar el curso';
  end if;
  update perfiles set activo = false, nombre = null where rol = 'alumno';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.cerrar_curso() from public, anon;
grant execute on function public.cerrar_curso() to authenticated;
