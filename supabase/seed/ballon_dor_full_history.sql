-- Football Timeline — seed: TODOS los ganadores reales del Balón de Oro (1956-2025, sin contar 2020,
-- que France Football no entregó por la pandemia). Reemplaza el enfoque anterior de timelines fijos
-- y curados a mano: ahora Ballon d'Or Timeline genera una ventana de 4 ediciones consecutivas al
-- azar en cada partida, a partir de este registro histórico completo (ver
-- 0014_ballon_dor_random_window.sql para la RPC que hace esa selección).
--
-- Cada evento se etiqueta con metadata->>'ballon_dor_edition' = el año de esa edición — así la RPC
-- puede recuperar el historial completo en orden sin depender de ningún timeline intermedio.
-- El título incluye el número de premio para jugadores repetidores (Messi, Cristiano Ronaldo,
-- Cruyff...) para que cada evento tenga un título distinto y no colisione con `where not exists`.

-- Retira el timeline curado anterior: ya no encaja con el mecanismo de ventana aleatoria.
update timelines
set status = 'archived', is_daily_eligible = false
where slug = 'ballon-dor-2004-2007';

insert into subjects (subject_type, name, slug)
select 'player', v.name, v.slug
from (
  values
    ('Stanley Matthews', 'stanley-matthews'),
    ('Alfredo Di Stéfano', 'alfredo-di-stefano'),
    ('Raymond Kopa', 'raymond-kopa'),
    ('Luis Suárez Miramontes', 'luis-suarez-miramontes'),
    ('Omar Sívori', 'omar-sivori'),
    ('Josef Masopust', 'josef-masopust'),
    ('Lev Yashin', 'lev-yashin'),
    ('Denis Law', 'denis-law'),
    ('Eusébio', 'eusebio'),
    ('Bobby Charlton', 'bobby-charlton'),
    ('Flórián Albert', 'florian-albert'),
    ('George Best', 'george-best'),
    ('Gianni Rivera', 'gianni-rivera'),
    ('Gerd Müller', 'gerd-muller'),
    ('Johan Cruyff', 'johan-cruyff'),
    ('Franz Beckenbauer', 'franz-beckenbauer'),
    ('Oleg Blojín', 'oleg-blojin'),
    ('Allan Simonsen', 'allan-simonsen'),
    ('Kevin Keegan', 'kevin-keegan'),
    ('Karl-Heinz Rummenigge', 'karl-heinz-rummenigge'),
    ('Paolo Rossi', 'paolo-rossi'),
    ('Michel Platini', 'michel-platini'),
    ('Igor Belanov', 'igor-belanov'),
    ('Ruud Gullit', 'ruud-gullit'),
    ('Marco van Basten', 'marco-van-basten'),
    ('Lothar Matthäus', 'lothar-matthaus'),
    ('Jean-Pierre Papin', 'jean-pierre-papin'),
    ('Roberto Baggio', 'roberto-baggio'),
    ('Hristo Stoichkov', 'hristo-stoichkov'),
    ('George Weah', 'george-weah'),
    ('Matthias Sammer', 'matthias-sammer'),
    ('Ronaldo Nazário', 'ronaldo-nazario'),
    ('Zinedine Zidane', 'zinedine-zidane'),
    ('Rivaldo', 'rivaldo'),
    ('Luís Figo', 'luis-figo'),
    ('Michael Owen', 'michael-owen'),
    ('Pavel Nedvěd', 'pavel-nedved'),
    ('Andriy Shevchenko', 'andriy-shevchenko'),
    ('Ronaldinho', 'ronaldinho'),
    ('Fabio Cannavaro', 'fabio-cannavaro'),
    ('Kaká', 'kaka'),
    ('Cristiano Ronaldo', 'cristiano-ronaldo'),
    ('Lionel Messi', 'lionel-messi'),
    ('Luka Modrić', 'luka-modric'),
    ('Karim Benzema', 'karim-benzema'),
    ('Rodri Hernández', 'rodri-hernandez'),
    ('Ousmane Dembélé', 'ousmane-dembele')
) as v(name, slug)
where not exists (select 1 from subjects where subjects.slug = v.slug);

insert into events (title, description, event_date, date_precision, display_date, subject_id, metadata)
select v.title, v.description, v.event_date::date, 'year', v.display_date,
       (select id from subjects where slug = v.subject_slug),
       jsonb_build_object('ballon_dor_edition', v.edition)
from (
  values
    ('Stanley Matthews gana el primer Balón de Oro', 'Extremo inglés del Blackpool F. C., primer ganador de la historia del premio.', '1956-12-01', '1956', 'stanley-matthews', 1956),
    ('Alfredo Di Stéfano gana su primer Balón de Oro', 'Delantero del Real Madrid.', '1957-12-01', '1957', 'alfredo-di-stefano', 1957),
    ('Raymond Kopa gana el Balón de Oro', 'Centrocampista francés del Real Madrid.', '1958-12-01', '1958', 'raymond-kopa', 1958),
    ('Alfredo Di Stéfano gana su segundo Balón de Oro', 'Delantero del Real Madrid.', '1959-12-01', '1959', 'alfredo-di-stefano', 1959),
    ('Luis Suárez Miramontes gana el Balón de Oro', 'Centrocampista del F. C. Barcelona.', '1960-12-01', '1960', 'luis-suarez-miramontes', 1960),
    ('Omar Sívori gana el Balón de Oro', 'Delantero de la Juventus F. C.', '1961-12-01', '1961', 'omar-sivori', 1961),
    ('Josef Masopust gana el Balón de Oro', 'Centrocampista checoslovaco del Dukla Praga, subcampeón del Mundial ese mismo año.', '1962-12-01', '1962', 'josef-masopust', 1962),
    ('Lev Yashin gana el Balón de Oro', 'Portero soviético del Dinamo de Moscú, hasta hoy el único arquero en ganarlo.', '1963-12-01', '1963', 'lev-yashin', 1963),
    ('Denis Law gana el Balón de Oro', 'Delantero escocés del Manchester United.', '1964-12-01', '1964', 'denis-law', 1964),
    ('Eusébio gana el Balón de Oro', 'Delantero portugués del Benfica, máximo goleador del Mundial de 1966.', '1965-12-01', '1965', 'eusebio', 1965),
    ('Bobby Charlton gana el Balón de Oro', 'Centrocampista inglés del Manchester United, campeón del Mundial con Inglaterra ese mismo año.', '1966-12-01', '1966', 'bobby-charlton', 1966),
    ('Flórián Albert gana el Balón de Oro', 'Delantero húngaro del Ferencváros.', '1967-12-01', '1967', 'florian-albert', 1967),
    ('George Best gana el Balón de Oro', 'Extremo norirlandés del Manchester United.', '1968-12-01', '1968', 'george-best', 1968),
    ('Gianni Rivera gana el Balón de Oro', 'Centrocampista del A. C. Milan.', '1969-12-01', '1969', 'gianni-rivera', 1969),
    ('Gerd Müller gana el Balón de Oro', 'Delantero alemán del Bayern de Múnich.', '1970-12-01', '1970', 'gerd-muller', 1970),
    ('Johan Cruyff gana su primer Balón de Oro', 'Delantero neerlandés del A. F. C. Ajax.', '1971-12-01', '1971', 'johan-cruyff', 1971),
    ('Franz Beckenbauer gana su primer Balón de Oro', 'Defensa alemán del Bayern de Múnich.', '1972-12-01', '1972', 'franz-beckenbauer', 1972),
    ('Johan Cruyff gana su segundo Balón de Oro', 'Delantero neerlandés, recién fichado por el F. C. Barcelona.', '1973-12-01', '1973', 'johan-cruyff', 1973),
    ('Johan Cruyff gana su tercer Balón de Oro', 'Delantero neerlandés del F. C. Barcelona.', '1974-12-01', '1974', 'johan-cruyff', 1974),
    ('Oleg Blojín gana el Balón de Oro', 'Delantero soviético del Dynamo Kiev.', '1975-12-01', '1975', 'oleg-blojin', 1975),
    ('Franz Beckenbauer gana su segundo Balón de Oro', 'Defensa alemán del Bayern de Múnich.', '1976-12-01', '1976', 'franz-beckenbauer', 1976),
    ('Allan Simonsen gana el Balón de Oro', 'Delantero danés del Borussia Mönchengladbach.', '1977-12-01', '1977', 'allan-simonsen', 1977),
    ('Kevin Keegan gana su primer Balón de Oro', 'Delantero inglés del Hamburger S. V.', '1978-12-01', '1978', 'kevin-keegan', 1978),
    ('Kevin Keegan gana su segundo Balón de Oro', 'Delantero inglés del Hamburger S. V.', '1979-12-01', '1979', 'kevin-keegan', 1979),
    ('Karl-Heinz Rummenigge gana su primer Balón de Oro', 'Delantero alemán del Bayern de Múnich.', '1980-12-01', '1980', 'karl-heinz-rummenigge', 1980),
    ('Karl-Heinz Rummenigge gana su segundo Balón de Oro', 'Delantero alemán del Bayern de Múnich.', '1981-12-01', '1981', 'karl-heinz-rummenigge', 1981),
    ('Paolo Rossi gana el Balón de Oro', 'Delantero italiano de la Juventus, tras ganar el Mundial con Italia.', '1982-12-01', '1982', 'paolo-rossi', 1982),
    ('Michel Platini gana su primer Balón de Oro', 'Centrocampista francés de la Juventus.', '1983-12-01', '1983', 'michel-platini', 1983),
    ('Michel Platini gana su segundo Balón de Oro', 'Centrocampista francés de la Juventus.', '1984-12-01', '1984', 'michel-platini', 1984),
    ('Michel Platini gana su tercer Balón de Oro', 'Centrocampista francés de la Juventus.', '1985-12-01', '1985', 'michel-platini', 1985),
    ('Igor Belanov gana el Balón de Oro', 'Delantero soviético del Dynamo Kiev.', '1986-12-01', '1986', 'igor-belanov', 1986),
    ('Ruud Gullit gana el Balón de Oro', 'Centrocampista neerlandés del A. C. Milan.', '1987-12-01', '1987', 'ruud-gullit', 1987),
    ('Marco van Basten gana su primer Balón de Oro', 'Delantero neerlandés del A. C. Milan.', '1988-12-01', '1988', 'marco-van-basten', 1988),
    ('Marco van Basten gana su segundo Balón de Oro', 'Delantero neerlandés del A. C. Milan.', '1989-12-01', '1989', 'marco-van-basten', 1989),
    ('Lothar Matthäus gana el Balón de Oro', 'Centrocampista alemán del Inter de Milán, capitán campeón del Mundial ese año.', '1990-12-01', '1990', 'lothar-matthaus', 1990),
    ('Jean-Pierre Papin gana el Balón de Oro', 'Delantero francés del Olympique de Marsella.', '1991-12-01', '1991', 'jean-pierre-papin', 1991),
    ('Marco van Basten gana su tercer Balón de Oro', 'Delantero neerlandés del A. C. Milan.', '1992-12-01', '1992', 'marco-van-basten', 1992),
    ('Roberto Baggio gana el Balón de Oro', 'Delantero italiano de la Juventus.', '1993-12-01', '1993', 'roberto-baggio', 1993),
    ('Hristo Stoichkov gana el Balón de Oro', 'Delantero búlgaro del F. C. Barcelona.', '1994-12-01', '1994', 'hristo-stoichkov', 1994),
    ('George Weah gana el Balón de Oro', 'Delantero liberiano del A. C. Milan, único africano en ganarlo hasta hoy.', '1995-12-01', '1995', 'george-weah', 1995),
    ('Matthias Sammer gana el Balón de Oro', 'Defensa alemán del Borussia Dortmund.', '1996-12-01', '1996', 'matthias-sammer', 1996),
    ('Ronaldo Nazário gana su primer Balón de Oro', 'Delantero brasileño del Inter de Milán.', '1997-12-01', '1997', 'ronaldo-nazario', 1997),
    ('Zinedine Zidane gana el Balón de Oro', 'Centrocampista francés de la Juventus, tras ganar el Mundial con Francia.', '1998-12-01', '1998', 'zinedine-zidane', 1998),
    ('Rivaldo gana el Balón de Oro', 'Delantero brasileño del F. C. Barcelona.', '1999-12-01', '1999', 'rivaldo', 1999),
    ('Luís Figo gana el Balón de Oro', 'Extremo portugués, recién fichado por el Real Madrid.', '2000-12-01', '2000', 'luis-figo', 2000),
    ('Michael Owen gana el Balón de Oro', 'Delantero inglés del Liverpool.', '2001-12-01', '2001', 'michael-owen', 2001),
    ('Ronaldo Nazário gana su segundo Balón de Oro', 'Delantero brasileño, ya en el Real Madrid, tras ganar el Mundial con Brasil.', '2002-12-01', '2002', 'ronaldo-nazario', 2002),
    ('Pavel Nedvěd gana el Balón de Oro', 'Centrocampista checo de la Juventus.', '2003-12-01', '2003', 'pavel-nedved', 2003),
    ('Andriy Shevchenko gana el Balón de Oro', 'Delantero ucraniano del A. C. Milan.', '2004-12-01', '2004', 'andriy-shevchenko', 2004),
    ('Ronaldinho gana el Balón de Oro', 'Extremo brasileño del F. C. Barcelona.', '2005-12-01', '2005', 'ronaldinho', 2005),
    ('Fabio Cannavaro gana el Balón de Oro', 'Defensa italiano, capitán de la selección campeona del Mundial ese año.', '2006-12-01', '2006', 'fabio-cannavaro', 2006),
    ('Kaká gana el Balón de Oro', 'Mediapunta brasileño del A. C. Milan.', '2007-12-01', '2007', 'kaka', 2007),
    ('Cristiano Ronaldo gana su primer Balón de Oro', 'Extremo portugués del Manchester United.', '2008-12-01', '2008', 'cristiano-ronaldo', 2008),
    ('Lionel Messi gana su primer Balón de Oro', 'Delantero argentino del F. C. Barcelona.', '2009-12-01', '2009', 'lionel-messi', 2009),
    ('Lionel Messi gana su segundo Balón de Oro', 'Delantero argentino del F. C. Barcelona.', '2010-12-01', '2010', 'lionel-messi', 2010),
    ('Lionel Messi gana su tercer Balón de Oro', 'Delantero argentino del F. C. Barcelona.', '2011-12-01', '2011', 'lionel-messi', 2011),
    ('Lionel Messi gana su cuarto Balón de Oro', 'Delantero argentino del F. C. Barcelona.', '2012-12-01', '2012', 'lionel-messi', 2012),
    ('Cristiano Ronaldo gana su segundo Balón de Oro', 'Delantero portugués del Real Madrid.', '2013-12-01', '2013', 'cristiano-ronaldo', 2013),
    ('Cristiano Ronaldo gana su tercer Balón de Oro', 'Delantero portugués del Real Madrid.', '2014-12-01', '2014', 'cristiano-ronaldo', 2014),
    ('Lionel Messi gana su quinto Balón de Oro', 'Delantero argentino del F. C. Barcelona.', '2015-12-01', '2015', 'lionel-messi', 2015),
    ('Cristiano Ronaldo gana su cuarto Balón de Oro', 'Delantero portugués del Real Madrid.', '2016-12-01', '2016', 'cristiano-ronaldo', 2016),
    ('Cristiano Ronaldo gana su quinto Balón de Oro', 'Delantero portugués del Real Madrid.', '2017-12-01', '2017', 'cristiano-ronaldo', 2017),
    ('Luka Modrić gana el Balón de Oro', 'Centrocampista croata del Real Madrid, tras ganar la Champions y llegar a la final del Mundial.', '2018-12-01', '2018', 'luka-modric', 2018),
    ('Lionel Messi gana su sexto Balón de Oro', 'Delantero argentino del F. C. Barcelona.', '2019-12-01', '2019', 'lionel-messi', 2019),
    ('Lionel Messi gana su séptimo Balón de Oro', 'Delantero argentino, ya en el Paris Saint-Germain, tras ganar la Copa América con Argentina.', '2021-12-01', '2021', 'lionel-messi', 2021),
    ('Karim Benzema gana el Balón de Oro', 'Delantero francés del Real Madrid, máximo goleador de la Champions esa temporada.', '2022-10-01', '2022', 'karim-benzema', 2022),
    ('Lionel Messi gana su octavo Balón de Oro', 'Delantero argentino, ya en el Inter Miami, tras ganar el Mundial con Argentina.', '2023-10-01', '2023', 'lionel-messi', 2023),
    ('Rodri Hernández gana el Balón de Oro', 'Centrocampista español del Manchester City.', '2024-10-01', '2024', 'rodri-hernandez', 2024),
    ('Ousmane Dembélé gana el Balón de Oro', 'Extremo francés del Paris Saint-Germain.', '2025-10-01', '2025', 'ousmane-dembele', 2025)
) as v(title, description, event_date, display_date, subject_slug, edition)
where not exists (
  select 1 from events e
  where e.title = v.title and e.subject_id = (select id from subjects where slug = v.subject_slug)
);
