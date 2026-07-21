# supabase/seed

Timelines reales curados por el propietario del producto, listos para aplicarse directamente.

- `career_cristiano_ronaldo.sql` — Career Timeline, dificultad media (6 clubes).
- `ballon_dor_recent.sql` — Ballon d'Or Timeline, dificultad difícil (8 ganadores, 2015-2023;
  2020 se omite a propósito porque ese año no se entregó el premio).

Aplicar con la CLI de Supabase una vez vinculado el proyecto:

```bash
npx supabase db execute --file supabase/seed/career_cristiano_ronaldo.sql
npx supabase db execute --file supabase/seed/ballon_dor_recent.sql
```

o pegando el contenido en el SQL editor del dashboard de Supabase. Ambos scripts son seguros de
re-ejecutar (usan `where not exists` para no duplicar filas).

Los siguientes 4 modos (Achievement, Club, Tournament, Transfer) se seedean en la Fase 3.
