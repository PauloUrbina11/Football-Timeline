-- Football Timeline — patch: fusiona Career Timeline y Transfer Timeline (compartían el mismo tema,
-- "los clubes de un jugador") y reutiliza el slot de Transfer para un modo completamente nuevo:
-- adivinar el valor real de un fichaje histórico en euros. Ver docs/architecture.md.
--
-- Career Timeline pasa de "sort" a "match, year-slots" (mismo mecanismo que tenía Transfer). Su
-- seed real (Cristiano Ronaldo, correct_order ascendente por año, sin repetidos) ya es 100%
-- compatible con ese mecanismo sin tocar un solo evento — solo cambia el registro del modo en el
-- cliente (modes-registry.ts), no hace falta ninguna migración de datos para ese timeline.
--
-- El timeline de Zlatan Ibrahimović (antes bajo mode_id='transfer') se muda a mode_id='career':
-- sigue siendo "los clubes de un jugador", ahora unificado bajo un solo modo.
update timelines
set mode_id = 'career'
where slug = 'zlatan-ibrahimovic-transfers';

-- Transfer Timeline se resiembra desde cero con el nuevo modo "guess": adivinar el valor real de
-- un fichaje histórico en euros, con pistas de "más alto"/"más bajo" (ver 0013_guess_mode.sql).
-- Difficulty "single": un único reto, no una lista que ordenar.
insert into subjects (subject_type, name, slug, metadata)
select 'player', 'Neymar', 'neymar-jr', '{"nationality": "Brasil"}'
where not exists (select 1 from subjects where slug = 'neymar-jr');

insert into events (title, description, event_date, date_precision, display_date, subject_id, metadata)
select 'Fichaje de Neymar por el Paris Saint-Germain',
       'El PSG paga la cláusula de rescisión de Neymar en el FC Barcelona, marcando un récord mundial en su momento.',
       '2017-08-03', 'year', '2017',
       (select id from subjects where slug = 'neymar-jr'), '{}'::jsonb
where not exists (
  select 1 from events e
  where e.title = 'Fichaje de Neymar por el Paris Saint-Germain'
    and e.subject_id = (select id from subjects where slug = 'neymar-jr')
);

insert into timelines (mode_id, subject_id, difficulty, title, slug, description, status, is_daily_eligible)
select 'transfer', (select id from subjects where slug = 'neymar-jr'), 'single',
       'El fichaje de Neymar por el PSG', 'neymar-psg-transfer-value',
       'Adivina, en euros, cuánto pagó el PSG por el fichaje de Neymar en 2017. Te diremos si tu cifra es más alta o más baja que la real.',
       'draft', false
where not exists (select 1 from timelines where slug = 'neymar-psg-transfer-value');

insert into timeline_events (timeline_id, event_id, correct_order)
select t.id, e.id, 1
from timelines t
join events e on e.title = 'Fichaje de Neymar por el Paris Saint-Germain'
  and e.subject_id = (select id from subjects where slug = 'neymar-jr')
where t.slug = 'neymar-psg-transfer-value'
  and not exists (select 1 from timeline_events te where te.timeline_id = t.id and te.event_id = e.id);

-- El valor real NUNCA va en events.metadata (es de lectura pública) — ver event_secret_values.
insert into event_secret_values (event_id, value_eur)
select e.id, 222000000
from events e
where e.title = 'Fichaje de Neymar por el Paris Saint-Germain'
  and e.subject_id = (select id from subjects where slug = 'neymar-jr')
on conflict (event_id) do update set value_eur = excluded.value_eur;

update timelines
set status = 'published', published_at = now()
where slug = 'neymar-psg-transfer-value' and status = 'draft';
