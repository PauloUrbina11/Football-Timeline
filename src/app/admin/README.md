# /admin

Se implementa en la **Fase 5**: `layout.tsx` (guard de rol admin, responde 404 si no-admin),
`timelines/*` (CRUD + Event Builder), `events/page.tsx` (buscador), `daily-challenges/*` (calendario),
`import/page.tsx` (importación CSV con dry-run). Usa `src/lib/supabase/admin.ts` solo tras verificar el rol.
