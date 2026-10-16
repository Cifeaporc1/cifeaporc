-- =====================================================================
-- CIFEAPORC · Esquema de la base de datos (fase 1)
-- Pegar entero en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar una sola vez sobre un proyecto vacío.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Granjas ---------------------------------------------------
create table public.granjas (
  id     smallint primary key,
  nombre text not null
);
insert into public.granjas (id, nombre) values
  (1, 'Granja 1.º curso'),
  (2, 'Granja 2.º curso');

-- ---------- Perfiles (sin datos personales) ---------------------------
-- Cada usuario tiene un alias (A07, B11…) y un rol. Los alumnos pertenecen
-- a una granja; los profesores ven las dos.
create table public.perfiles (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  alias     text not null,
  rol       text not null check (rol in ('alumno', 'profesor')),
  granja_id smallint references public.granjas(id),
  activo    boolean not null default true,
  creado    timestamptz not null default now(),
  check (rol = 'profesor' or granja_id is not null)
);
create unique index perfiles_alias_granja on public.perfiles (upper(alias), coalesce(granja_id, 0));

-- ---------- Censo común -----------------------------------------------
create table public.cerdas (
  id               uuid primary key default gen_random_uuid(),
  crotal           text not null unique,
  otros_crotales   text[] not null default '{}',
  raza             text not null default 'Chato murciano',
  fecha_nacimiento date,
  fecha_entrada    date,
  origen           text,            -- explotación de procedencia (reposición)
  fecha_baja       date,
  causa_baja       text,
  creado           timestamptz not null default now()
);

create table public.verracos (
  id               uuid primary key default gen_random_uuid(),
  crotal           text not null unique,
  raza             text not null default 'Chato murciano',
  fecha_nacimiento date,
  fecha_entrada    date,
  verraquera       smallint check (verraquera between 1 and 5),
  fecha_baja       date,
  causa_baja       text,
  creado           timestamptz not null default now()
);

-- ---------- Eventos (lo que registra cada granja) ----------------------
-- Todo lo que ocurre a una cerda en una granja: inseminación, ecografía,
-- entrada en paridera, parto, adopción, bajas de lechones, destete, traslado.
create table public.eventos (
  id             uuid primary key default gen_random_uuid(),
  granja_id      smallint not null references public.granjas(id),
  cerda_id       uuid not null references public.cerdas(id) on delete cascade,
  tipo           text not null check (tipo in
                   ('ia','eco','paridera','parto','adopcion','baja_lechones','destete','traslado','nota')),
  fecha          date not null,
  datos          jsonb not null default '{}'::jsonb,
  autor          uuid references auth.users(id) on delete set null,
  autor_alias    text,
  creado         timestamptz not null default now(),
  modificado     timestamptz,
  modificado_por text
);
create index eventos_granja_cerda on public.eventos (granja_id, cerda_id, fecha);

-- ---------- Funciones de ayuda para las reglas de acceso --------------
create or replace function public.es_profesor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles
                 where user_id = auth.uid() and rol = 'profesor' and activo);
$$;

create or replace function public.mi_granja() returns smallint
language sql stable security definer set search_path = public as $$
  select granja_id from perfiles where user_id = auth.uid() and activo;
$$;

create or replace function public.tiene_acceso() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where user_id = auth.uid() and activo);
$$;

-- Autor y fechas de cada evento: los pone la base de datos, no el móvil.
create or replace function public.eventos_autoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text;
begin
  select alias into a from perfiles where user_id = auth.uid();
  if tg_op = 'INSERT' then
    new.autor := auth.uid();
    new.autor_alias := a;
    new.creado := now();
    new.modificado := null;
    new.modificado_por := null;
  else
    new.autor := old.autor;
    new.autor_alias := old.autor_alias;
    new.creado := old.creado;
    new.granja_id := old.granja_id;
    new.modificado := now();
    new.modificado_por := a;
  end if;
  return new;
end $$;
create trigger eventos_autoria before insert or update on public.eventos
  for each row execute function public.eventos_autoria();

-- ---------- Reglas de acceso (RLS) -------------------------------------
alter table public.granjas  enable row level security;
alter table public.perfiles enable row level security;
alter table public.cerdas   enable row level security;
alter table public.verracos enable row level security;
alter table public.eventos  enable row level security;

create policy granjas_ver on public.granjas for select to authenticated
  using (public.tiene_acceso());

create policy perfiles_ver on public.perfiles for select to authenticated
  using (user_id = auth.uid() or public.es_profesor());
create policy perfiles_alta on public.perfiles for insert to authenticated
  with check (public.es_profesor());
create policy perfiles_cambio on public.perfiles for update to authenticated
  using (public.es_profesor()) with check (public.es_profesor());

create policy cerdas_ver on public.cerdas for select to authenticated
  using (public.tiene_acceso());
create policy cerdas_alta on public.cerdas for insert to authenticated
  with check (public.es_profesor());
create policy cerdas_cambio on public.cerdas for update to authenticated
  using (public.es_profesor()) with check (public.es_profesor());

create policy verracos_ver on public.verracos for select to authenticated
  using (public.tiene_acceso());
create policy verracos_alta on public.verracos for insert to authenticated
  with check (public.es_profesor());
create policy verracos_cambio on public.verracos for update to authenticated
  using (public.es_profesor()) with check (public.es_profesor());

-- Cada alumno solo ve y registra en su granja; el profesor, en las dos.
create policy eventos_ver on public.eventos for select to authenticated
  using (public.es_profesor() or granja_id = public.mi_granja());
create policy eventos_alta on public.eventos for insert to authenticated
  with check (public.es_profesor() or granja_id = public.mi_granja());
-- El alumno corrige o borra lo suyo durante 24 h; después, solo el profesor.
create policy eventos_cambio on public.eventos for update to authenticated
  using (public.es_profesor()
         or (autor = auth.uid() and granja_id = public.mi_granja()
             and creado > now() - interval '24 hours'))
  with check (public.es_profesor() or granja_id = public.mi_granja());
create policy eventos_borrado on public.eventos for delete to authenticated
  using (public.es_profesor()
         or (autor = auth.uid() and granja_id = public.mi_granja()
             and creado > now() - interval '24 hours'));

-- ---------- Funciones del profesor -------------------------------------
-- Asignar un PIN nuevo a un alumno que lo ha olvidado.
create or replace function public.restablecer_pin(p_user uuid, p_pin text)
returns void language plpgsql security definer
set search_path = public, extensions, auth as $$
begin
  if not public.es_profesor() then
    raise exception 'Solo el profesor puede restablecer PIN';
  end if;
  if p_pin !~ '^[0-9]{6}$' then
    raise exception 'El PIN debe tener 6 cifras';
  end if;
  if not exists (select 1 from public.perfiles where user_id = p_user and rol = 'alumno') then
    raise exception 'Solo se puede restablecer el PIN de un alumno';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user;
end $$;
revoke all on function public.restablecer_pin(uuid, text) from public, anon;
grant execute on function public.restablecer_pin(uuid, text) to authenticated;

-- Consulta mínima que usa la tarea automática para que Supabase no
-- pause el proyecto en vacaciones (no devuelve ningún dato).
create or replace function public.ping() returns text
language sql stable as $$ select 'ok'::text $$;
grant execute on function public.ping() to anon, authenticated;
