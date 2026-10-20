-- =====================================================================
-- CIFEAPORC · Recuentos de animales en lechoneras y cebadero (para el plano)
-- Pegar entero en Supabase → SQL Editor → New query → Run. Repetible.
-- Necesita haber ejecutado antes 01 y 05.
-- =====================================================================

create table if not exists public.recuentos (
  id             uuid primary key default gen_random_uuid(),
  granja_id      smallint not null references public.granjas(id),
  estancia       text not null check (estancia ~ '^(Lechonera [1-4]|Cebadero ([1-9]|1[0-9]|2[0-4]))$'),
  fecha          date not null,
  n              integer not null check (n between 0 and 200),
  obs            text,
  autor          uuid references auth.users(id) on delete set null,
  autor_alias    text,
  creado         timestamptz not null default now(),
  modificado     timestamptz,
  modificado_por text
);
create index if not exists recuentos_granja on public.recuentos (granja_id, estancia, fecha);

drop trigger if exists recuentos_autoria on public.recuentos;
create trigger recuentos_autoria before insert or update on public.recuentos
  for each row execute function public.eventos_autoria();

alter table public.recuentos enable row level security;
drop policy if exists recuentos_ver on public.recuentos;
drop policy if exists recuentos_alta on public.recuentos;
drop policy if exists recuentos_cambio on public.recuentos;
drop policy if exists recuentos_borrado on public.recuentos;
create policy recuentos_ver on public.recuentos for select to authenticated
  using (public.es_profesor() or granja_id = public.mi_granja());
create policy recuentos_alta on public.recuentos for insert to authenticated
  with check (public.es_profesor() or granja_id = public.mi_granja());
create policy recuentos_cambio on public.recuentos for update to authenticated
  using (public.es_profesor()
         or (autor = auth.uid() and granja_id = public.mi_granja() and creado > now() - interval '24 hours'))
  with check (public.es_profesor() or granja_id = public.mi_granja());
create policy recuentos_borrado on public.recuentos for delete to authenticated
  using (public.es_profesor()
         or (autor = auth.uid() and granja_id = public.mi_granja() and creado > now() - interval '24 hours'));
