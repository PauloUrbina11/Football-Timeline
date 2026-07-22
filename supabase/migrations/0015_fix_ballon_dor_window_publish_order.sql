-- Football Timeline — 0015: corrige un bug real en generate_random_ballon_dor_window (0014).
--
-- Insertaba la fila de `timelines` con `status = 'published'` en el mismo paso, ANTES de insertar
-- sus `timeline_events` — pero `trg_timelines_publish_integrity` (0001) corre `before insert` y
-- cuenta `timeline_events` para `new.id` en ese mismo instante, que siempre es 0 para una fila
-- recién creada. La función fallaba el 100% de las veces con "tiene 0 eventos, se esperaban 4".
--
-- Todos los seeds ya seguían el patrón correcto (insertar en 'draft', poblar timeline_events, y
-- solo al final UPDATE a 'published') — esta función simplemente no lo seguía. Detectado por el
-- primer intento real de jugar tras aplicar 0014 (ver docs/architecture.md).

create or replace function generate_random_ballon_dor_window()
returns table (timeline_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_ids uuid[];
  v_subject_ids uuid[];
  v_editions int[];
  v_n int;
  v_start int;
  v_tries int := 0;
  v_max_tries constant int := 300;
  v_ok boolean := false;
  v_start_edition int;
  v_end_edition int;
  v_era text;
  v_multiplier numeric;
  v_slug text;
  v_title text;
  v_description text;
  v_new_timeline_id uuid;
  v_name_order uuid[];
  v_i int;
begin
  select array_agg(e.id order by (e.metadata->>'ballon_dor_edition')::int),
         array_agg(e.subject_id order by (e.metadata->>'ballon_dor_edition')::int),
         array_agg((e.metadata->>'ballon_dor_edition')::int order by (e.metadata->>'ballon_dor_edition')::int)
    into v_event_ids, v_subject_ids, v_editions
  from events e
  where e.metadata ? 'ballon_dor_edition' and e.deleted_at is null;

  v_n := coalesce(array_length(v_event_ids, 1), 0);
  if v_n < 4 then
    raise exception 'No hay suficiente historial de Balón de Oro cargado (% ediciones)', v_n;
  end if;

  loop
    v_tries := v_tries + 1;
    v_start := 1 + floor(random() * (v_n - 3))::int;
    v_ok := v_subject_ids[v_start] <> v_subject_ids[v_start + 1]
      and v_subject_ids[v_start] <> v_subject_ids[v_start + 2]
      and v_subject_ids[v_start] <> v_subject_ids[v_start + 3]
      and v_subject_ids[v_start + 1] <> v_subject_ids[v_start + 2]
      and v_subject_ids[v_start + 1] <> v_subject_ids[v_start + 3]
      and v_subject_ids[v_start + 2] <> v_subject_ids[v_start + 3];
    exit when v_ok or v_tries >= v_max_tries;
  end loop;

  if not v_ok then
    raise exception 'No se encontró una ventana de 4 ediciones con ganadores distintos tras % intentos', v_max_tries;
  end if;

  v_start_edition := v_editions[v_start];
  v_end_edition := v_editions[v_start + 3];

  v_era := case
    when v_start_edition < 1980 then 'clásica'
    when v_start_edition < 2000 then 'dorada'
    when v_start_edition < 2014 then 'moderna'
    else 'reciente'
  end;
  v_multiplier := case
    when v_start_edition < 1980 then 1.5
    when v_start_edition < 2000 then 1.3
    when v_start_edition < 2014 then 1.15
    else 1.0
  end;

  v_slug := 'ballon-dor-' || v_start_edition || '-' || v_end_edition || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  v_title := 'Balón de Oro ' || v_start_edition || '-' || v_end_edition;
  v_description := 'Arrastra cada balón al jugador que ganó el Balón de Oro ese año. Época ' || v_era || '.';

  -- 1) Crear en 'draft' (el trigger de integridad no exige nada todavía en este estado).
  insert into timelines (mode_id, subject_id, difficulty, title, slug, description, status, is_daily_eligible, metadata)
  values (
    'ballon_dor', null, 'easy', v_title, v_slug, v_description, 'draft', false,
    jsonb_build_object('era', v_era, 'difficulty_multiplier', v_multiplier, 'edition_start', v_start_edition, 'edition_end', v_end_edition)
  )
  returning id into v_new_timeline_id;

  -- 2) Poblar timeline_events. correct_order = rango alfabético por nombre entre estos 4 jugadores
  -- (ver 0012, mismo criterio: nunca por edición/año, eso revelaría quién ganó antes que quién).
  select array_agg(ranked.event_id order by ranked.subject_name)
    into v_name_order
  from (
    select v_event_ids[v_start + offset_i] as event_id, s.name as subject_name
    from generate_series(0, 3) as offset_i
    join subjects s on s.id = v_subject_ids[v_start + offset_i]
  ) as ranked;

  for v_i in 1..4 loop
    insert into timeline_events (timeline_id, event_id, correct_order)
    values (v_new_timeline_id, v_name_order[v_i], v_i);
  end loop;

  -- 3) Publicar ahora que timeline_events ya tiene sus 4 filas: el trigger valida en este UPDATE.
  update timelines set status = 'published', published_at = now() where id = v_new_timeline_id;

  return query select v_new_timeline_id, v_slug;
end;
$$;
