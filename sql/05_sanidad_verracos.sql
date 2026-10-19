-- =====================================================================
-- CIFEAPORC · Sanidad, catálogo de medicamentos y extracciones de verracos
-- Pegar entero en Supabase → SQL Editor → New query → Run. Repetible.
-- =====================================================================

-- ---------- Catálogo de medicamentos y productos (común a las dos granjas)
create table if not exists public.medicamentos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,              -- nombre comercial
  materia_activa text,
  tipo           text not null default 'medicamento'
                 check (tipo in ('medicamento','vacuna','antiparasitario','hierro','biocida','otro')),
  presentacion   text,
  dosis          text,                       -- dosificación (texto libre: "1 ml/10 kg")
  via            text,                       -- modo de aplicación
  supresion_dias integer check (supresion_dias >= 0),  -- periodo de supresión (carne)
  lote           text,
  caducidad      date,
  ficha_url      text,                       -- enlace a la ficha técnica (CIMAVet…)
  notas          text,
  activo         boolean not null default true,
  creado         timestamptz not null default now()
);

-- ---------- Registros de sanidad: previstos y realizados (por granja)
create table if not exists public.sanidad (
  id              uuid primary key default gen_random_uuid(),
  granja_id       smallint not null references public.granjas(id),
  estado          text not null check (estado in ('previsto','realizado')),
  tipo            text not null check (tipo in ('vacunacion','desparasitacion','tratamiento','hierro',
                    'colmillos','raboteo','castracion','limpieza','desinfeccion','desinsectacion',
                    'desratizacion','otro')),
  fecha           date not null,             -- prevista o realizada
  ambito          text not null check (ambito in ('granja','zona','cerda','camada','verraco')),
  cerda_id        uuid references public.cerdas(id) on delete cascade,
  verraco_id      uuid references public.verracos(id) on delete cascade,
  zona            text,
  n_animales      integer check (n_animales >= 0),
  medicamento_id  uuid references public.medicamentos(id) on delete set null,
  producto        text,                      -- nombre del producto en el momento del registro
  dosis           text,
  via             text,
  lote            text,
  caducidad       date,
  supresion_hasta date,
  motivo          text,
  obs             text,
  repetir_dias    integer check (repetir_dias > 0),
  autor           uuid references auth.users(id) on delete set null,
  autor_alias     text,
  realizado_por   text,
  creado          timestamptz not null default now(),
  modificado      timestamptz,
  modificado_por  text
);
create index if not exists sanidad_granja_fecha on public.sanidad (granja_id, fecha);

-- ---------- Extracciones de semen (por granja)
create table if not exists public.extracciones (
  id                 uuid primary key default gen_random_uuid(),
  granja_id          smallint not null references public.granjas(id),
  verraco_id         uuid not null references public.verracos(id) on delete cascade,
  fecha              date not null,          -- extracción (día 0)
  fecha_verificacion date,                   -- comprobación de la dosis conservada
  n_dosis            integer not null check (n_dosis >= 0),
  motilidad          integer check (motilidad between 0 and 100),
  volumen            integer check (volumen >= 0),   -- c.c. del eyaculado
  obs                text,
  autor              uuid references auth.users(id) on delete set null,
  autor_alias        text,
  creado             timestamptz not null default now(),
  modificado         timestamptz,
  modificado_por     text
);
create index if not exists extracciones_granja on public.extracciones (granja_id, verraco_id, fecha);

-- ---------- Autoría (la pone la base de datos)
drop trigger if exists extracciones_autoria on public.extracciones;
create trigger extracciones_autoria before insert or update on public.extracciones
  for each row execute function public.eventos_autoria();

create or replace function public.sanidad_autoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text;
begin
  select alias into a from perfiles where user_id = auth.uid();
  if tg_op = 'INSERT' then
    new.autor := auth.uid(); new.autor_alias := a; new.creado := now();
    new.modificado := null; new.modificado_por := null;
    new.realizado_por := case when new.estado = 'realizado' then a end;
  else
    new.autor := old.autor; new.autor_alias := old.autor_alias; new.creado := old.creado;
    new.granja_id := old.granja_id; new.modificado := now(); new.modificado_por := a;
    if old.estado = 'previsto' and new.estado = 'realizado' then new.realizado_por := a;
    else new.realizado_por := old.realizado_por; end if;
  end if;
  return new;
end $$;
drop trigger if exists sanidad_autoria on public.sanidad;
create trigger sanidad_autoria before insert or update on public.sanidad
  for each row execute function public.sanidad_autoria();

-- ---------- Reglas de acceso
alter table public.medicamentos enable row level security;
alter table public.sanidad      enable row level security;
alter table public.extracciones enable row level security;

drop policy if exists medicamentos_ver on public.medicamentos;
drop policy if exists medicamentos_alta on public.medicamentos;
drop policy if exists medicamentos_cambio on public.medicamentos;
create policy medicamentos_ver on public.medicamentos for select to authenticated using (public.tiene_acceso());
create policy medicamentos_alta on public.medicamentos for insert to authenticated with check (public.es_profesor());
create policy medicamentos_cambio on public.medicamentos for update to authenticated using (public.es_profesor()) with check (public.es_profesor());

-- Sanidad: cada curso ve y registra lo suyo. Un alumno puede marcar como realizado
-- un tratamiento PREVISTO de su granja; lo demás, solo lo suyo durante 24 h.
drop policy if exists sanidad_ver on public.sanidad;
drop policy if exists sanidad_alta on public.sanidad;
drop policy if exists sanidad_cambio on public.sanidad;
drop policy if exists sanidad_borrado on public.sanidad;
create policy sanidad_ver on public.sanidad for select to authenticated
  using (public.es_profesor() or granja_id = public.mi_granja());
create policy sanidad_alta on public.sanidad for insert to authenticated
  with check (public.es_profesor() or granja_id = public.mi_granja());
create policy sanidad_cambio on public.sanidad for update to authenticated
  using (public.es_profesor()
         or (granja_id = public.mi_granja()
             and (estado = 'previsto' or (autor = auth.uid() and creado > now() - interval '24 hours'))))
  with check (public.es_profesor() or granja_id = public.mi_granja());
create policy sanidad_borrado on public.sanidad for delete to authenticated
  using (public.es_profesor()
         or (autor = auth.uid() and granja_id = public.mi_granja() and creado > now() - interval '24 hours'));

drop policy if exists extracciones_ver on public.extracciones;
drop policy if exists extracciones_alta on public.extracciones;
drop policy if exists extracciones_cambio on public.extracciones;
drop policy if exists extracciones_borrado on public.extracciones;
create policy extracciones_ver on public.extracciones for select to authenticated
  using (public.es_profesor() or granja_id = public.mi_granja());
create policy extracciones_alta on public.extracciones for insert to authenticated
  with check (public.es_profesor() or granja_id = public.mi_granja());
create policy extracciones_cambio on public.extracciones for update to authenticated
  using (public.es_profesor()
         or (autor = auth.uid() and granja_id = public.mi_granja() and creado > now() - interval '24 hours'))
  with check (public.es_profesor() or granja_id = public.mi_granja());
create policy extracciones_borrado on public.extracciones for delete to authenticated
  using (public.es_profesor()
         or (autor = auth.uid() and granja_id = public.mi_granja() and creado > now() - interval '24 hours'));
