-- Football Timeline — 0016: Ballon d'Or Timeline deja de descartar ventanas con un ganador
-- repetido (33 de las 66 posiciones posibles se perdían por eso). En vez de evitarlas, se resuelve
-- la ambigüedad: cuando un jugador aparece más de una vez en la misma ventana, su casillero se
-- etiqueta con el ordinal REAL de ese premio en su carrera — "Messi (5)" para su quinto Balón de
-- Oro — no una posición arbitraria dentro de la ventana. Es un dato real y verificable, mismo
-- criterio que revelar el año en Transfer/Career: el jugador tiene que saber cuál de sus propios
-- Balones de Oro corresponde a cuál año, no solo "sabe que ganó varias veces".
--
-- Nota: para un jugador repetido, el orden visual entre sus casilleros queda determinado por
-- edición ascendente (desempate estable al generar la ventana) — eso ya lo revela el propio número
-- ordinal ("(5)" es antes que "(7)"), así que ordenarlos así no añade ningún espóiler nuevo.

create or replace function get_ballon_dor_match_slots(p_timeline_id uuid)
returns table (slot_index smallint, label text)
language sql
security definer
stable
set search_path = public
as $$
  with slot_events as (
    select te.correct_order,
           s.name as subject_name,
           (
             select count(*) from events e2
             where e2.subject_id = e.subject_id
               and e2.metadata ? 'ballon_dor_edition'
               and (e2.metadata->>'ballon_dor_edition')::int <= (e.metadata->>'ballon_dor_edition')::int
           ) as career_ordinal,
           count(*) over (partition by e.subject_id) as repeats_in_window
    from timeline_events te
    join events e on e.id = te.event_id
    join subjects s on s.id = e.subject_id
    join timelines t on t.id = te.timeline_id
    where te.timeline_id = p_timeline_id
      and t.status = 'published'
      and t.deleted_at is null
      and e.deleted_at is null
  )
  select correct_order::smallint,
         case when repeats_in_window > 1 then subject_name || ' (' || career_ordinal || ')' else subject_name end
  from slot_events
  order by correct_order;
$$;

-- generate_random_ballon_dor_window ya no valida distinción de ganadores: usa cualquiera de las 66
-- posiciones de inicio posibles. El desempate entre repetidos (para el orden alfabético→correct_order)
-- pasa a ser (nombre, edición) en vez de solo nombre, para que sea estable y determinista.
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

  v_start := 1 + floor(random() * (v_n - 3))::int;

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

  insert into timelines (mode_id, subject_id, difficulty, title, slug, description, status, is_daily_eligible, metadata)
  values (
    'ballon_dor', null, 'easy', v_title, v_slug, v_description, 'draft', false,
    jsonb_build_object('era', v_era, 'difficulty_multiplier', v_multiplier, 'edition_start', v_start_edition, 'edition_end', v_end_edition)
  )
  returning id into v_new_timeline_id;

  select array_agg(ranked.event_id order by ranked.subject_name, ranked.edition)
    into v_name_order
  from (
    select v_event_ids[v_start + offset_i] as event_id, s.name as subject_name, v_editions[v_start + offset_i] as edition
    from generate_series(0, 3) as offset_i
    join subjects s on s.id = v_subject_ids[v_start + offset_i]
  ) as ranked;

  for v_i in 1..4 loop
    insert into timeline_events (timeline_id, event_id, correct_order)
    values (v_new_timeline_id, v_name_order[v_i], v_i);
  end loop;

  update timelines set status = 'published', published_at = now() where id = v_new_timeline_id;

  return query select v_new_timeline_id, v_slug;
end;
$$;
