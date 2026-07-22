-- Football Timeline — 0017: prerrequisitos de datos para el módulo PvP.
-- No crea nada de PvP todavía (eso empieza en 0019) — solo dos columnas que faltaban en tablas
-- que ya existen, para no duplicar información en una tabla nueva:
--   - profiles.country: no existía (solo había `locale`, que es idioma, no país) y el ranking PvP
--     por país lo necesita.
--   - game_modes.pvp_enabled / pvp_weight: "excluir modos deshabilitados" y "respetar
--     probabilidades configurables" al elegir los 3 juegos de un duelo — el dato vive donde ya
--     vive el resto de la configuración de cada modo, no en una tabla de configuración aparte.

alter table profiles add column country text;

alter table game_modes add column pvp_enabled boolean not null default true;
alter table game_modes add column pvp_weight numeric not null default 1 check (pvp_weight >= 0);
