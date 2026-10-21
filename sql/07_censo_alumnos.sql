-- =====================================================================
-- CIFEAPORC · Altas y bajas por los alumnos (con firma) y movimientos
--             de lechoneras y cebadero (entradas, traslados, bajas, ventas)
-- Pegar entero en Supabase → SQL Editor → New query → Run. Repetible.
-- Necesita haber ejecutado antes 01, 05 y 06.
-- =====================================================================

-- ---------- 1. Censo: quién da el alta y la baja
alter table public.cerdas   add column if not exists alta_autor uuid, add column if not exists alta_por text,
  add column if not exists baja_por text, add column if not exists modificado timestamptz, add column if not exists modificado_por text;
alter table public.verracos add column if not exists alta_autor uuid, add column if not exists alta_por text,
  add column if not exists baja_por text, add column if not exists modificado timestamptz, add column if not exists modificado_por text;

-- Historial de altas y bajas (lo rellena la base de datos)
create table if not exists public.censo_mov (
  id          uuid primary key default gen_random_uuid(),
  animal      text not null check (animal in ('cerda','verraco')),
  animal_id   uuid not null,
  crotal      text not null,
  mov         text not null check (mov in ('alta','baja','baja_anulada')),
  fecha       date not null,
  causa       text,
  granja_id   smallint,             -- curso de quien lo hizo (vacío si fue el profesor)
  autor       uuid,
  autor_alias text,
  creado      timestamptz not null default now()
);
create index if not exists censo_mov_creado on public.censo_mov (creado desc);

-- Reglas: cualquiera da altas y bajas y traslada verracos de verraquera. Un alumno no puede cambiar los datos de un animal
-- (salvo el que él mismo dio de alta hace menos de 24 h) ni anular una baja: eso, el profesor.
create or replace function public.censo_control() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text; prof boolean; quitar text[] := array['fecha_baja','causa_baja','baja_por','modificado','modificado_por','verraquera'];
begin
  select alias into a from perfiles where user_id = auth.uid();
  prof := auth.uid() is null or es_profesor();   -- sin usuario = SQL Editor (profesor)
  if tg_op = 'INSERT' then
    new.alta_autor := auth.uid(); new.alta_por := a; new.creado := now();
    new.baja_por := case when new.fecha_baja is not null then a end;
    new.modificado := null; new.modificado_por := null;
    return new;
  end if;
  new.alta_autor := old.alta_autor; new.alta_por := old.alta_por; new.creado := old.creado;
  if not prof and not (old.alta_autor = auth.uid() and old.creado > now() - interval '24 hours') then
    if (to_jsonb(new) - quitar) is distinct from (to_jsonb(old) - quitar) then
      raise exception 'Solo el profesor puede cambiar los datos de un animal. Tú puedes darlo de baja.';
    end if;
    if old.fecha_baja is not null and (new.fecha_baja is distinct from old.fecha_baja or new.causa_baja is distinct from old.causa_baja) then
      raise exception 'Solo el profesor puede anular o corregir una baja.';
    end if;
  end if;
  if new.fecha_baja is not null and new.causa_baja is null then
    raise exception 'Indica la causa de la baja.';
  end if;
  if old.fecha_baja is null and new.fecha_baja is not null then new.baja_por := a;
  elsif new.fecha_baja is null then new.baja_por := null;
  else new.baja_por := old.baja_por; end if;
  new.modificado := now(); new.modificado_por := a;
  return new;
end $$;

create or replace function public.censo_registro() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text; g smallint; tipo text := case when tg_table_name = 'cerdas' then 'cerda' else 'verraco' end;
begin
  select alias, granja_id into a, g from perfiles where user_id = auth.uid();
  if tg_op = 'INSERT' then
    insert into censo_mov (animal, animal_id, crotal, mov, fecha, granja_id, autor, autor_alias)
      values (tipo, new.id, new.crotal, 'alta', coalesce(new.fecha_entrada, current_date), g, auth.uid(), a);
  end if;
  if new.fecha_baja is not null and (tg_op = 'INSERT' or old.fecha_baja is null) then
    insert into censo_mov (animal, animal_id, crotal, mov, fecha, causa, granja_id, autor, autor_alias)
      values (tipo, new.id, new.crotal, 'baja', new.fecha_baja, new.causa_baja, g, auth.uid(), a);
  elsif tg_op = 'UPDATE' and old.fecha_baja is not null and new.fecha_baja is null then
    insert into censo_mov (animal, animal_id, crotal, mov, fecha, causa, granja_id, autor, autor_alias)
      values (tipo, new.id, new.crotal, 'baja_anulada', current_date, old.causa_baja, g, auth.uid(), a);
  end if;
  return null;
end $$;

drop trigger if exists cerdas_control on public.cerdas;
drop trigger if exists verracos_control on public.verracos;
drop trigger if exists cerdas_registro on public.cerdas;
drop trigger if exists verracos_registro on public.verracos;
create trigger cerdas_control before insert or update on public.cerdas for each row execute function public.censo_control();
create trigger verracos_control before insert or update on public.verracos for each row execute function public.censo_control();
create trigger cerdas_registro after insert or update on public.cerdas for each row execute function public.censo_registro();
create trigger verracos_registro after insert or update on public.verracos for each row execute function public.censo_registro();

drop policy if exists cerdas_alta on public.cerdas;
drop policy if exists cerdas_cambio on public.cerdas;
drop policy if exists verracos_alta on public.verracos;
drop policy if exists verracos_cambio on public.verracos;
create policy cerdas_alta on public.cerdas for insert to authenticated with check (public.tiene_acceso());
create policy cerdas_cambio on public.cerdas for update to authenticated using (public.tiene_acceso()) with check (public.tiene_acceso());
create policy verracos_alta on public.verracos for insert to authenticated with check (public.tiene_acceso());
create policy verracos_cambio on public.verracos for update to authenticated using (public.tiene_acceso()) with check (public.tiene_acceso());

alter table public.censo_mov enable row level security;
drop policy if exists censo_mov_ver on public.censo_mov;
create policy censo_mov_ver on public.censo_mov for select to authenticated using (public.tiene_acceso());
-- (sin permisos de escritura: solo la escribe la base de datos)

-- ---------- 2. Lechoneras y cebadero: entradas, traslados, muertes, ventas y matadero
create table if not exists public.mov_grupos (
  id             uuid primary key default gen_random_uuid(),
  granja_id      smallint not null references public.granjas(id),
  fecha          date not null,
  tipo           text not null check (tipo in ('entrada','traslado','muerte','venta','matadero')),
  origen         text check (origen  ~ '^(Lechonera [1-4]|Cebadero ([1-9]|1[0-9]|2[0-4]))$'),
  destino        text check (destino ~ '^(Lechonera [1-4]|Cebadero ([1-9]|1[0-9]|2[0-4]))$'),
  n              integer not null check (n between 1 and 200),
  procedencia    text,           -- en las entradas
  causa          text,           -- en las muertes
  obs            text,
  autor          uuid references auth.users(id) on delete set null,
  autor_alias    text,
  creado         timestamptz not null default now(),
  modificado     timestamptz,
  modificado_por text,
  check (case tipo when 'entrada'  then destino is not null and origen is null
                   when 'traslado' then origen is not null and destino is not null and origen <> destino
                   else origen is not null and destino is null end),
  check (tipo <> 'muerte' or causa is not null)
);
create index if not exists mov_grupos_granja on public.mov_grupos (granja_id, fecha);

drop trigger if exists mov_grupos_autoria on public.mov_grupos;
create trigger mov_grupos_autoria before insert or update on public.mov_grupos
  for each row execute function public.eventos_autoria();

alter table public.mov_grupos enable row level security;
drop policy if exists mov_grupos_ver on public.mov_grupos;
drop policy if exists mov_grupos_alta on public.mov_grupos;
drop policy if exists mov_grupos_cambio on public.mov_grupos;
drop policy if exists mov_grupos_borrado on public.mov_grupos;
create policy mov_grupos_ver on public.mov_grupos for select to authenticated
  using (public.es_profesor() or granja_id = public.mi_granja());
create policy mov_grupos_alta on public.mov_grupos for insert to authenticated
  with check (public.es_profesor() or granja_id = public.mi_granja());
create policy mov_grupos_cambio on public.mov_grupos for update to authenticated
  using (public.es_profesor()
         or (autor = auth.uid() and granja_id = public.mi_granja() and creado > now() - interval '24 hours'))
  with check (public.es_profesor() or granja_id = public.mi_granja());
create policy mov_grupos_borrado on public.mov_grupos for delete to authenticated
  using (public.es_profesor()
         or (autor = auth.uid() and granja_id = public.mi_granja() and creado > now() - interval '24 hours'));
