-- Football Timeline — patch: 10 ediciones del Balón de Oro ya existían como `events` (creadas por
-- seeds anteriores de esta misma sesión: el timeline curado archivado "ballon-dor-2004-2007" y el
-- "ballon-dor-2015-2023" original) con el MISMO título exacto que usó `ballon_dor_full_history.sql`
-- — así que su guarda `where not exists (title+subject_id)` las encontró ya creadas y no les añadió
-- `metadata->>'ballon_dor_edition'`. Sin esa marca, `generate_random_ballon_dor_window` no las ve.
-- Se completa la marca en las filas existentes en vez de duplicarlas.

update events e
set metadata = e.metadata || jsonb_build_object('ballon_dor_edition', v.edition)
from (
  values
    ('Andriy Shevchenko gana el Balón de Oro', 'andriy-shevchenko', 2004),
    ('Ronaldinho gana el Balón de Oro', 'ronaldinho', 2005),
    ('Fabio Cannavaro gana el Balón de Oro', 'fabio-cannavaro', 2006),
    ('Kaká gana el Balón de Oro', 'kaka', 2007),
    ('Lionel Messi gana su quinto Balón de Oro', 'lionel-messi', 2015),
    ('Cristiano Ronaldo gana su quinto Balón de Oro', 'cristiano-ronaldo', 2017),
    ('Luka Modrić gana el Balón de Oro', 'luka-modric', 2018),
    ('Lionel Messi gana su sexto Balón de Oro', 'lionel-messi', 2019),
    ('Karim Benzema gana el Balón de Oro', 'karim-benzema', 2022),
    ('Lionel Messi gana su octavo Balón de Oro', 'lionel-messi', 2023)
) as v(title, subject_slug, edition)
where e.title = v.title
  and e.subject_id = (select id from subjects where slug = v.subject_slug)
  and not (e.metadata ? 'ballon_dor_edition');
