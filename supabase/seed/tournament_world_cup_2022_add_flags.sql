-- Football Timeline — parche de contenido: añade banderas a los eventos ya sembrados del Mundial de
-- Catar, y cambia la descripción del timeline al enunciado que se muestra como instrucción del
-- tablero. Solo UPDATE: no toca IDs ni timeline_events.

update events set metadata = '{"flags": ["🇸🇦", "🇦🇷"]}'::jsonb
where title = 'Arabia Saudita vence a Argentina';

update events set metadata = '{"flags": ["🇲🇦", "🇵🇹"]}'::jsonb
where title = 'Marruecos elimina a Portugal';

update events set metadata = '{"flags": ["🇫🇷", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"]}'::jsonb
where title = 'Francia elimina a Inglaterra';

update events set metadata = '{"flags": ["🇦🇷", "🇫🇷"]}'::jsonb
where title = 'Argentina vence a Francia en la final';

update timelines set description = 'Ordena qué partido fue primero en el Mundial de Catar 2022.'
where slug = 'mundial-catar-momentos-clave';
