-- Football Timeline — 0006: corrige un bug real de RLS encontrado en la Fase 2.
--
-- Las policies de SELECT de game_sessions/game_attempts/daily_results no contemplaban las
-- sesiones anónimas (user_id is null), aunque la intención documentada en 0002/0004 sí lo hacía.
-- Esto rompía el INSERT de una nueva sesión desde el cliente anónimo: `Prefer: return=representation`
-- (lo que hace supabase-js cuando se encadena `.select()` tras `.insert()`) exige que la fila
-- insertada también sea legible bajo la policy de SELECT, no solo bajo la de INSERT.
--
-- Idempotente: seguro de re-ejecutar.

drop policy if exists "sessions_own_read" on game_sessions;
create policy "sessions_own_read" on game_sessions for select
  using (user_id = auth.uid() or user_id is null or is_admin(auth.uid()));

drop policy if exists "attempts_own_read" on game_attempts;
create policy "attempts_own_read" on game_attempts for select
  using (exists (
    select 1 from game_sessions s
    where s.id = session_id and (s.user_id = auth.uid() or s.user_id is null or is_admin(auth.uid()))
  ));

drop policy if exists "daily_results_own_read" on daily_results;
create policy "daily_results_own_read" on daily_results for select
  using (user_id = auth.uid() or user_id is null or is_admin(auth.uid()));
