-- Football Timeline — parche de contenido (Fase 2): quita los años de los títulos/descripciones
-- del Balón de Oro ya sembrados, y del título del propio timeline. Ver ballon_dor_recent.sql
-- (fuente de verdad ya corregida) para el detalle de por qué. Solo UPDATE: no toca IDs ni
-- timeline_events, así que no rompe ninguna sesión ya jugada contra esta base.

update events set title = 'Lionel Messi gana su quinto Balón de Oro',
  description = 'Empata en ese momento con Cristiano Ronaldo como máximo ganador del premio.'
where title = 'Lionel Messi gana el Balón de Oro 2015';

update events set title = 'Cristiano Ronaldo gana el Balón de Oro tras la Champions y la Eurocopa',
  description = 'Balón de Oro tras ganar la Champions League con el Real Madrid y la Eurocopa con Portugal.'
where title = 'Cristiano Ronaldo gana el Balón de Oro 2016';

update events set title = 'Cristiano Ronaldo gana su quinto Balón de Oro',
  description = 'Iguala a Lionel Messi en el número total de premios.'
where title = 'Cristiano Ronaldo gana el Balón de Oro 2017';

update events set title = 'Luka Modrić gana el Balón de Oro'
where title = 'Luka Modrić gana el Balón de Oro 2018';

update events set title = 'Lionel Messi gana su sexto Balón de Oro',
  description = 'Se convierte en el máximo ganador en solitario del premio.'
where title = 'Lionel Messi gana el Balón de Oro 2019';

update events set title = 'Lionel Messi gana el Balón de Oro tras la Copa América',
  description = 'Su séptimo Balón de Oro, tras ganar por fin un título con la selección argentina. La edición anterior del premio no se había entregado.'
where title = 'Lionel Messi gana el Balón de Oro 2021';

update events set title = 'Karim Benzema gana el Balón de Oro'
where title = 'Karim Benzema gana el Balón de Oro 2022';

update events set title = 'Lionel Messi gana su octavo Balón de Oro',
  description = 'Llega tras ganar el Mundial con la selección argentina.'
where title = 'Lionel Messi gana el Balón de Oro 2023';

update timelines set title = 'Ganadores recientes del Balón de Oro'
where slug = 'ballon-dor-2015-2023';
