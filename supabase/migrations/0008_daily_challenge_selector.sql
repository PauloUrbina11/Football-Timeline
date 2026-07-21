-- Football Timeline — 0008: selección determinista del daily challenge (Fase 3).
--
-- `ensure_daily_challenge` es `security definer` porque necesita poder insertar en
-- `daily_challenges`, tabla cuya única policy de escritura es admin-only (ver 0002/0004) —
-- este es exactamente el caso de "fallback autocurativo del sistema" para el que se documentó
-- ese diseño en docs/architecture.md.
--
-- El índice determinista es "días desde la época Unix, módulo nº de timelines elegibles":
-- misma fecha -> mismo índice siempre, sin necesitar estado ni un hash opaco. La misma fórmula
-- se replica en src/features/daily-challenge/domain/daily-selector.ts (con tests) como referencia
-- para quien la lea en TypeScript; la versión SQL de aquí es la que realmente se ejecuta.

create or replace function ensure_daily_challenge(p_date date default (now() at time zone 'utc')::date)
returns table (challenge_id uuid, timeline_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing daily_challenges;
  v_count int;
  v_index int;
  v_selected_timeline_id uuid;
  v_inserted daily_challenges;
begin
  select * into v_existing from daily_challenges where challenge_date = p_date;
  if v_existing is not null then
    challenge_id := v_existing.id;
    timeline_id := v_existing.timeline_id;
    return next;
    return;
  end if;

  select count(*) into v_count
  from timelines
  where status = 'published' and is_daily_eligible = true and deleted_at is null;

  if v_count = 0 then
    raise exception 'No hay timelines elegibles para el daily challenge';
  end if;

  v_index := (p_date - date '1970-01-01') % v_count;

  select id into v_selected_timeline_id
  from (
    select id, row_number() over (order by id) - 1 as rn
    from timelines
    where status = 'published' and is_daily_eligible = true and deleted_at is null
  ) ranked
  where rn = v_index;

  insert into daily_challenges (challenge_date, timeline_id)
  values (p_date, v_selected_timeline_id)
  on conflict (challenge_date) do nothing
  returning * into v_inserted;

  if v_inserted is null then
    -- Otra request concurrente ya lo insertó justo antes: se lee lo que quedó guardado.
    select * into v_inserted from daily_challenges where challenge_date = p_date;
  end if;

  challenge_id := v_inserted.id;
  timeline_id := v_inserted.timeline_id;
  return next;
end;
$$;
