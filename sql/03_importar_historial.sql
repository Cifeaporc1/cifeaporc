-- =====================================================================
-- CIFEAPORC · Importación del historial de las fichas anteriores
-- 14 cerdas, sus inseminaciones, partos, abortos y destetes.
-- Pegar entero en Supabase → SQL Editor → New query → Run.
-- Se puede volver a ejecutar: borra antes lo importado y lo carga de nuevo.
-- Lo importado aparece en las DOS granjas (1.º y 2.º) como
-- "Importado de las fichas anteriores".
-- =====================================================================

-- 1. Nuevo tipo de evento: aborto
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in
  ('ia','eco','paridera','parto','aborto','adopcion','baja_lechones','destete','traslado','nota'));

-- 2. Verracos que aparecen en las fichas (si ya existen, no se tocan)
insert into public.verracos (crotal) values
  ('K-02'),
  ('K-03'),
  ('K-04'),
  ('K-05'),
  ('K-06'),
  ('K-07')
on conflict (crotal) do nothing;

-- 3. Cerdas (si ya existen, solo se completan las fechas que falten)
insert into public.cerdas (crotal, raza, fecha_nacimiento, fecha_entrada) values
  ('A01', 'Chato murciano', null::date, '2024-01-01'::date),
  ('A18', 'Chato murciano', null::date, '2023-09-04'::date),
  ('R-473', 'Chato murciano', '2025-02-14'::date, '2026-02-12'::date),
  ('R-380', 'Chato murciano', '2023-01-11'::date, '2023-07-11'::date),
  ('R-384', 'Chato murciano', '2023-04-01'::date, '2023-10-01'::date),
  ('A13', 'Chato murciano', '2023-04-04'::date, '2023-09-04'::date),
  ('R-474', 'Chato murciano', '2025-02-14'::date, '2026-02-12'::date),
  ('R-439', 'Chato murciano', null::date, '2024-12-24'::date),
  ('R-414', 'Chato murciano', null::date, '2025-04-21'::date),
  ('R-398', 'Chato murciano', '2025-08-14'::date, '2025-08-15'::date),
  ('R-471', 'Chato murciano', '2025-02-14'::date, '2026-02-12'::date),
  ('R-400', 'Chato murciano', '2025-06-09'::date, '2025-10-15'::date),
  ('R-472', 'Chato murciano', '2025-02-06'::date, '2026-03-12'::date),
  ('R-415', 'Chato murciano', '2024-12-27'::date, '2025-04-27'::date)
on conflict (crotal) do update set
  fecha_nacimiento = coalesce(public.cerdas.fecha_nacimiento, excluded.fecha_nacimiento),
  fecha_entrada    = coalesce(public.cerdas.fecha_entrada, excluded.fecha_entrada);

-- 4. Historial (en las dos granjas)
alter table public.eventos disable trigger eventos_autoria;
delete from public.eventos where datos->>'origen' = 'historico';
insert into public.eventos (granja_id, cerda_id, tipo, fecha, datos, autor, autor_alias, creado)
select g.id, c.id, h.tipo, h.fecha::date,
       case when h.datos->>'verraco_crotal' is not null
            then h.datos || jsonb_build_object('verraco', (select v.id::text from public.verracos v where v.crotal = h.datos->>'verraco_crotal'))
            else h.datos end,
       null, 'Histórico', now() + h.orden * interval '1 millisecond'
from (values
  (0, 'A01', 'ia', '2024-06-18', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (1, 'A01', 'parto', '2024-10-10', '{"vivos_ss": 8, "muertos_ss": 8, "origen": "historico"}'::jsonb),
  (2, 'A01', 'destete', '2024-11-10', '{"destetados_ss": 8, "origen": "historico"}'::jsonb),
  (3, 'A01', 'ia', '2025-01-20', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (4, 'A01', 'parto', '2025-05-13', '{"vivos_ss": 6, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (5, 'A01', 'destete', '2025-07-27', '{"destetados_ss": 5, "origen": "historico"}'::jsonb),
  (6, 'A01', 'ia', '2025-07-29', '{"verraco_crotal": "K-02", "origen": "historico"}'::jsonb),
  (7, 'A01', 'parto', '2025-11-21', '{"vivos_ss": 7, "muertos_ss": 7, "origen": "historico"}'::jsonb),
  (8, 'A01', 'destete', '2026-01-09', '{"destetados_ss": 7, "origen": "historico"}'::jsonb),
  (9, 'A01', 'ia', '2026-01-13', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (10, 'A01', 'aborto', '2026-04-08', '{"origen": "historico"}'::jsonb),
  (11, 'A01', 'ia', '2026-05-25', '{"verraco_crotal": "K-06", "origen": "historico"}'::jsonb),
  (12, 'A01', 'parto', '2026-09-19', '{"vivos_ss": 6, "muertos_ss": 1, "origen": "historico"}'::jsonb),
  (13, 'A18', 'ia', '2023-10-04', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (14, 'A18', 'parto', '2024-01-27', '{"vivos_ss": 10, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (15, 'A18', 'destete', '2024-02-29', '{"destetados_ss": 9, "origen": "historico"}'::jsonb),
  (16, 'A18', 'ia', '2024-03-07', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (17, 'A18', 'parto', '2024-07-01', '{"vivos_ss": 6, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (18, 'A18', 'destete', '2024-08-12', '{"destetados_ss": 6, "origen": "historico"}'::jsonb),
  (19, 'A18', 'ia', '2024-09-07', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (20, 'A18', 'parto', '2025-01-01', '{"vivos_ss": 8, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (21, 'A18', 'destete', '2025-02-07', '{"destetados_ss": 8, "origen": "historico"}'::jsonb),
  (22, 'A18', 'ia', '2025-02-12', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (23, 'A18', 'aborto', '2025-04-30', '{"origen": "historico"}'::jsonb),
  (24, 'A18', 'ia', '2025-07-29', '{"verraco_crotal": "K-02", "origen": "historico"}'::jsonb),
  (25, 'A18', 'parto', '2025-11-22', '{"vivos_ss": 8, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (26, 'A18', 'destete', '2026-01-09', '{"destetados_ss": 6, "origen": "historico"}'::jsonb),
  (27, 'A18', 'ia', '2026-01-13', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (28, 'A18', 'parto', '2026-05-10', '{"vivos_ss": 7, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (29, 'A18', 'destete', '2026-07-03', '{"destetados_ss": 6, "origen": "historico"}'::jsonb),
  (30, 'A18', 'ia', '2026-07-08', '{"verraco_crotal": "K-05", "origen": "historico"}'::jsonb),
  (31, 'R-473', 'ia', '2026-03-22', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (32, 'R-473', 'parto', '2026-07-16', '{"vivos_ss": 7, "muertos_ss": 1, "origen": "historico"}'::jsonb),
  (33, 'R-380', 'ia', '2023-08-11', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (34, 'R-380', 'parto', '2023-12-03', '{"vivos_ss": 9, "muertos_ss": 2, "origen": "historico"}'::jsonb),
  (35, 'R-380', 'destete', '2024-01-07', '{"destetados_ss": 9, "origen": "historico"}'::jsonb),
  (36, 'R-380', 'ia', '2024-01-17', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (37, 'R-380', 'parto', '2024-05-12', '{"vivos_ss": 10, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (38, 'R-380', 'destete', '2024-06-15', '{"destetados_ss": 10, "origen": "historico"}'::jsonb),
  (39, 'R-380', 'ia', '2024-06-18', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (40, 'R-380', 'parto', '2024-10-11', '{"vivos_ss": 10, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (41, 'R-380', 'destete', '2024-11-18', '{"destetados_ss": 10, "origen": "historico"}'::jsonb),
  (42, 'R-380', 'ia', '2024-11-20', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (43, 'R-380', 'parto', '2025-03-16', '{"vivos_ss": 7, "muertos_ss": 3, "origen": "historico"}'::jsonb),
  (44, 'R-380', 'destete', '2025-04-25', '{"destetados_ss": 7, "origen": "historico"}'::jsonb),
  (45, 'R-380', 'ia', '2025-04-30', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (46, 'R-380', 'parto', '2025-08-23', '{"vivos_ss": 4, "muertos_ss": 3, "origen": "historico"}'::jsonb),
  (47, 'R-380', 'destete', '2025-09-23', '{"destetados_ss": 4, "origen": "historico"}'::jsonb),
  (48, 'R-380', 'ia', '2025-09-26', '{"verraco_crotal": "K-02", "origen": "historico"}'::jsonb),
  (49, 'R-380', 'parto', '2026-01-22', '{"vivos_ss": 6, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (50, 'R-380', 'destete', '2026-02-20', '{"destetados_ss": 6, "origen": "historico"}'::jsonb),
  (51, 'R-380', 'ia', '2026-02-25', '{"verraco_crotal": "K-07", "origen": "historico"}'::jsonb),
  (52, 'R-380', 'parto', '2026-06-20', '{"vivos_ss": 9, "muertos_ss": 1, "origen": "historico"}'::jsonb),
  (53, 'R-380', 'destete', '2026-08-20', '{"destetados_ss": 9, "origen": "historico"}'::jsonb),
  (54, 'R-380', 'ia', '2026-08-24', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (55, 'R-384', 'ia', '2023-10-04', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (56, 'R-384', 'parto', '2024-01-30', '{"vivos_ss": 9, "muertos_ss": 1, "origen": "historico"}'::jsonb),
  (57, 'R-384', 'destete', '2024-02-29', '{"destetados_ss": 8, "origen": "historico"}'::jsonb),
  (58, 'R-384', 'ia', '2024-03-06', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (59, 'R-384', 'parto', '2024-06-27', '{"vivos_ss": 6, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (60, 'R-384', 'destete', '2024-07-30', '{"destetados_ss": 6, "origen": "historico"}'::jsonb),
  (61, 'R-384', 'ia', '2024-08-25', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (62, 'R-384', 'parto', '2024-12-21', '{"vivos_ss": 6, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (63, 'R-384', 'destete', '2025-02-07', '{"destetados_ss": 6, "origen": "historico"}'::jsonb),
  (64, 'R-384', 'ia', '2025-02-11', '{"verraco_crotal": "K-02", "origen": "historico"}'::jsonb),
  (65, 'R-384', 'aborto', '2025-05-01', '{"origen": "historico"}'::jsonb),
  (66, 'R-384', 'ia', '2025-07-29', '{"verraco_crotal": "K-02", "origen": "historico"}'::jsonb),
  (67, 'R-384', 'parto', '2025-11-22', '{"vivos_ss": 4, "muertos_ss": 4, "origen": "historico"}'::jsonb),
  (68, 'R-384', 'destete', '2026-01-15', '{"destetados_ss": 4, "origen": "historico"}'::jsonb),
  (69, 'R-384', 'ia', '2026-02-02', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (70, 'R-384', 'parto', '2026-05-29', '{"vivos_ss": 5, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (71, 'R-384', 'destete', '2026-07-20', '{"destetados_ss": 5, "origen": "historico"}'::jsonb),
  (72, 'R-384', 'ia', '2026-07-25', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (73, 'A13', 'ia', '2023-10-04', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (74, 'A13', 'parto', '2024-01-29', '{"vivos_ss": 8, "muertos_ss": 1, "origen": "historico"}'::jsonb),
  (75, 'A13', 'destete', '2024-02-29', '{"destetados_ss": 7, "origen": "historico"}'::jsonb),
  (76, 'A13', 'ia', '2024-03-05', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (77, 'A13', 'parto', '2024-06-26', '{"vivos_ss": 8, "muertos_ss": 1, "origen": "historico"}'::jsonb),
  (78, 'A13', 'destete', '2024-08-19', '{"destetados_ss": 8, "origen": "historico"}'::jsonb),
  (79, 'A13', 'ia', '2024-08-23', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (80, 'A13', 'aborto', '2024-11-15', '{"origen": "historico"}'::jsonb),
  (81, 'A13', 'ia', '2025-01-07', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (82, 'A13', 'ia', '2025-03-10', '{"verraco_crotal": "K-04", "origen": "historico"}'::jsonb),
  (83, 'A13', 'parto', '2025-07-08', '{"vivos_ss": 9, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (84, 'A13', 'destete', '2025-08-29', '{"destetados_ss": 9, "origen": "historico"}'::jsonb),
  (85, 'A13', 'ia', '2025-09-01', '{"verraco_crotal": "K-02", "origen": "historico"}'::jsonb),
  (86, 'A13', 'aborto', '2025-12-10', '{"origen": "historico"}'::jsonb),
  (87, 'A13', 'ia', '2026-01-15', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (88, 'A13', 'aborto', '2026-02-26', '{"origen": "historico"}'::jsonb),
  (89, 'A13', 'ia', '2026-03-02', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (90, 'A13', 'aborto', '2026-06-10', '{"origen": "historico"}'::jsonb),
  (91, 'A13', 'ia', '2026-07-09', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (92, 'R-474', 'ia', '2026-03-20', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (93, 'R-474', 'parto', '2026-07-10', '{"vivos_ss": 9, "muertos_ss": 2, "origen": "historico"}'::jsonb),
  (94, 'R-474', 'destete', '2026-09-10', '{"destetados_ss": 9, "origen": "historico"}'::jsonb),
  (95, 'R-474', 'ia', '2026-09-22', '{"verraco_crotal": "K-05", "origen": "historico"}'::jsonb),
  (96, 'R-439', 'ia', '2025-05-24', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (97, 'R-439', 'parto', '2025-09-16', '{"vivos_ss": 6, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (98, 'R-439', 'destete', '2025-10-24', '{"destetados_ss": 5, "origen": "historico"}'::jsonb),
  (99, 'R-439', 'ia', '2025-11-17', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (100, 'R-439', 'ia', '2025-12-12', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (101, 'R-439', 'aborto', '2026-02-15', '{"origen": "historico"}'::jsonb),
  (102, 'R-439', 'ia', '2026-02-18', '{"verraco_crotal": "K-05", "origen": "historico"}'::jsonb),
  (103, 'R-439', 'parto', '2026-06-15', '{"vivos_ss": 9, "muertos_ss": 2, "origen": "historico"}'::jsonb),
  (104, 'R-439', 'destete', '2026-08-20', '{"destetados_ss": 9, "origen": "historico"}'::jsonb),
  (105, 'R-439', 'ia', '2026-08-25', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (106, 'R-414', 'ia', '2025-05-20', '{"verraco_crotal": "K-04", "origen": "historico"}'::jsonb),
  (107, 'R-414', 'parto', '2025-09-14', '{"vivos_ss": 6, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (108, 'R-414', 'destete', '2025-10-24', '{"destetados_ss": 6, "origen": "historico"}'::jsonb),
  (109, 'R-414', 'ia', '2025-10-30', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (110, 'R-414', 'parto', '2026-02-20', '{"vivos_ss": 8, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (111, 'R-414', 'ia', '2026-04-14', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (112, 'R-414', 'aborto', '2026-06-12', '{"origen": "historico"}'::jsonb),
  (113, 'R-414', 'ia', '2026-06-17', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (114, 'R-398', 'ia', '2026-05-16', '{"verraco_crotal": "K-05", "origen": "historico"}'::jsonb),
  (115, 'R-398', 'parto', '2026-09-07', '{"vivos_ss": 9, "muertos_ss": 1, "origen": "historico"}'::jsonb),
  (116, 'R-471', 'ia', '2026-03-20', '{"verraco_crotal": "K-05", "origen": "historico"}'::jsonb),
  (117, 'R-471', 'parto', '2026-07-14', '{"vivos_ss": 8, "muertos_ss": 5, "origen": "historico"}'::jsonb),
  (118, 'R-471', 'destete', '2026-09-17', '{"destetados_ss": 8, "origen": "historico"}'::jsonb),
  (119, 'R-400', 'ia', '2026-06-22', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (120, 'R-400', 'ia', '2026-08-23', '{"verraco_crotal": "K-05", "origen": "historico", "obs": "Ficha anterior: «(+1)» junto a la fecha"}'::jsonb),
  (121, 'R-472', 'ia', '2026-03-18', '{"verraco_crotal": "K-05", "origen": "historico"}'::jsonb),
  (122, 'R-472', 'parto', '2026-07-19', '{"vivos_ss": 4, "muertos_ss": 3, "origen": "historico"}'::jsonb),
  (123, 'R-472', 'destete', '2026-09-10', '{"destetados_ss": 4, "origen": "historico"}'::jsonb),
  (124, 'R-415', 'ia', '2025-05-27', '{"verraco_crotal": null, "origen": "historico"}'::jsonb),
  (125, 'R-415', 'parto', '2025-09-19', '{"vivos_ss": 9, "muertos_ss": 9, "origen": "historico"}'::jsonb),
  (126, 'R-415', 'destete', '2025-10-24', '{"destetados_ss": 9, "origen": "historico"}'::jsonb),
  (127, 'R-415', 'ia', '2025-10-30', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (128, 'R-415', 'parto', '2026-02-24', '{"vivos_ss": 9, "muertos_ss": 0, "origen": "historico"}'::jsonb),
  (129, 'R-415', 'ia', '2026-04-15', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (130, 'R-415', 'aborto', '2026-05-27', '{"origen": "historico"}'::jsonb),
  (131, 'R-415', 'ia', '2026-06-02', '{"verraco_crotal": "K-03", "origen": "historico"}'::jsonb),
  (132, 'R-415', 'parto', '2026-09-27', '{"vivos_ss": 10, "muertos_ss": 3, "origen": "historico"}'::jsonb)
) as h(orden, crotal, tipo, fecha, datos)
join public.cerdas c on c.crotal = h.crotal
cross join public.granjas g;
alter table public.eventos enable trigger eventos_autoria;

-- 5. Comprobación: debe salir 133 eventos por granja
select granja_id, count(*) as eventos_importados
from public.eventos where datos->>'origen' = 'historico'
group by granja_id order by granja_id;
