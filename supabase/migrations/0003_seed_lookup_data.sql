-- Football Timeline — 0003: datos de las tablas de referencia.
-- Deben mantenerse en sincronía con src/features/game-engine/domain/modes-registry.ts y types.ts.
-- Añadir un modo/dificultad nuevo = un INSERT aquí (o desde el admin) + su entrada en el registro TS.

insert into subject_types (id, label) values
  ('player', 'Jugador'),
  ('club', 'Club'),
  ('tournament', 'Torneo'),
  ('other', 'Otro');

insert into game_modes (id, name, description, icon, sort_order) values
  ('career', 'Career Timeline', 'Ordena los clubes por los que pasó un jugador.', '🎽', 1),
  ('achievement', 'Achievement Timeline', 'Ordena los logros más importantes de la carrera de un jugador.', '🏆', 2),
  ('club_coach', 'Club Timeline', 'Ordena a los entrenadores que dirigieron a un club.', '📋', 3),
  ('tournament', 'Tournament Timeline', 'Ordena los acontecimientos clave de un torneo.', '🌍', 4),
  ('transfer', 'Transfer Timeline', 'Ordena los fichajes de un jugador a lo largo de su carrera.', '🔄', 5),
  ('ballon_dor', 'Ballon d''Or Timeline', 'Ordena a los ganadores del Balón de Oro.', '⭐', 6);

insert into difficulties (id, label, event_count, sort_order) values
  ('easy', 'Fácil', 4, 1),
  ('medium', 'Media', 6, 2),
  ('hard', 'Difícil', 8, 3),
  ('expert', 'Experto', 10, 4);

insert into achievements (id, title, description, icon, criteria, sort_order) values
  ('first_win', 'Primera victoria', 'Completa tu primer timeline correctamente.', '🥇', '{"type": "wins", "value": 1}', 1),
  ('perfect_first_try', 'Ojo de halcón', 'Resuelve un timeline a la primera, sin errores.', '🎯', '{"type": "first_try", "value": 1}', 2),
  ('streak_7', 'Racha de una semana', 'Juega el reto diario 7 días consecutivos.', '🔥', '{"type": "streak", "value": 7}', 3),
  ('streak_30', 'Racha de un mes', 'Juega el reto diario 30 días consecutivos.', '🔥', '{"type": "streak", "value": 30}', 4),
  ('expert_five_stars', 'Maestro experto', 'Consigue 5 estrellas en dificultad Experto.', '👑', '{"type": "five_stars_at_difficulty", "value": "expert"}', 5);
