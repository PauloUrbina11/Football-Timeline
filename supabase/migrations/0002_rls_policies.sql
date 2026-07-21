-- Football Timeline — 0002: autorización (rol admin) y RLS.
-- Regla central: el cliente nunca debe poder leer `timeline_events.correct_order` en el flujo de
-- juego normal, y nunca puede escribir `game_attempts`/`scores` directamente — eso ocurre solo
-- vía RPC `security definer` (ver 0005), que sí puede leerlo internamente para verificar la respuesta.

create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = uid and role = 'admin');
$$;

-- Crea automáticamente un profile al registrarse un usuario.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, username) values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Impide que un usuario no-admin se auto-promueva a admin.
create or replace function protect_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> old.role and not is_admin(auth.uid()) then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_protect_role
  before update on profiles
  for each row execute function protect_role_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table subject_types enable row level security;
alter table game_modes enable row level security;
alter table difficulties enable row level security;
alter table achievements enable row level security;
alter table subjects enable row level security;
alter table events enable row level security;
alter table timelines enable row level security;
alter table timeline_events enable row level security;
alter table profiles enable row level security;
alter table game_sessions enable row level security;
alter table game_attempts enable row level security;
alter table scores enable row level security;
alter table user_streaks enable row level security;
alter table user_achievements enable row level security;

-- Tablas de referencia: lectura pública, escritura solo admin.
create policy "subject_types_read" on subject_types for select using (true);
create policy "subject_types_admin_write" on subject_types for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "game_modes_read" on game_modes for select using (true);
create policy "game_modes_admin_write" on game_modes for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "difficulties_read" on difficulties for select using (true);
create policy "difficulties_admin_write" on difficulties for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "achievements_read" on achievements for select using (true);
create policy "achievements_admin_write" on achievements for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "subjects_read" on subjects for select using (true);
create policy "subjects_admin_write" on subjects for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- events: público ve solo no-borrados; admin ve y escribe todo.
create policy "events_public_read" on events for select using (deleted_at is null);
create policy "events_admin_read" on events for select using (is_admin(auth.uid()));
create policy "events_admin_insert" on events for insert with check (is_admin(auth.uid()));
create policy "events_admin_update" on events for update using (is_admin(auth.uid()));
create policy "events_admin_delete" on events for delete using (is_admin(auth.uid()));

-- timelines: público ve solo published + no borrados; admin ve y escribe todo.
create policy "timelines_public_read" on timelines for select using (status = 'published' and deleted_at is null);
create policy "timelines_admin_read" on timelines for select using (is_admin(auth.uid()));
create policy "timelines_admin_write" on timelines for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- timeline_events: SOLO admin. El flujo de juego normal no consulta esta tabla directamente
-- (expondría `correct_order`); usa en su lugar las funciones `get_timeline_cards` / RPCs de 0005.
create policy "timeline_events_admin_all" on timeline_events for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- profiles: cada uno lee/edita el suyo; admin ve todos.
create policy "profiles_own_read" on profiles for select using (id = auth.uid() or is_admin(auth.uid()));
create policy "profiles_own_update" on profiles for update using (id = auth.uid());

-- game_sessions: se pueden crear e inspeccionar las propias (o anónimas sin user_id).
-- La policy de SELECT debe incluir "user_id is null": un INSERT con `Prefer: return=representation`
-- (el default de `.select()` en supabase-js) necesita leer de vuelta la fila insertada, así que la
-- policy de SELECT también se evalúa en ese momento, no solo la de INSERT.
-- Deliberadamente SIN policy de UPDATE: todo avance de sesión pasa por RPC security definer
-- (submit_attempt, finish_session), así el cliente no puede falsificar su propio resultado.
create policy "sessions_own_read" on game_sessions for select
  using (user_id = auth.uid() or user_id is null or is_admin(auth.uid()));
create policy "sessions_insert_own" on game_sessions for insert with check (user_id = auth.uid() or user_id is null);

-- game_attempts: lectura solo de las propias (vía join a la sesión); sin insert/update directo.
create policy "attempts_own_read" on game_attempts for select
  using (exists (
    select 1 from game_sessions s
    where s.id = session_id and (s.user_id = auth.uid() or s.user_id is null or is_admin(auth.uid()))
  ));

-- scores: el leaderboard es público; sin insert/update directo (solo RPC finish_session).
create policy "scores_public_read" on scores for select using (true);

-- user_streaks / user_achievements: cada uno ve los suyos; sin escritura directa (solo RPC).
create policy "streaks_own_read" on user_streaks for select using (user_id = auth.uid() or is_admin(auth.uid()));
create policy "user_achievements_own_read" on user_achievements for select using (user_id = auth.uid() or is_admin(auth.uid()));

-- Vista pública sin datos sensibles, para mostrar en rankings.
create view public_profiles as
  select id, username, display_name, avatar_url from profiles;
