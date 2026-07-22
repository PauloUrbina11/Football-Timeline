import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateAnonId } from "@/lib/anon-id";

/**
 * Crea la fila de `game_sessions` compartida por los dos modos de interacción (sort y match).
 * No es una Server Action en sí misma (no lleva "use server"): la invocan start-session.ts y
 * start-match-session.ts, que sí lo son. `difficulty`/`total_events` son placeholders que el
 * trigger `set_session_fields_from_timeline` (0005) sobrescribe siempre con los valores reales.
 */
export async function createGameSession(timelineId: string, dailyChallengeId?: string): Promise<string> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const anonId = userId ? null : await getOrCreateAnonId();

  // Se genera el id en el cliente (servidor) para no depender de `RETURNING` tras el insert:
  // evita que la policy de SELECT de game_sessions entre en juego solo para leer de vuelta la fila.
  const sessionId = crypto.randomUUID();
  const { error: sessionError } = await supabase.from("game_sessions").insert({
    id: sessionId,
    timeline_id: timelineId,
    user_id: userId,
    anon_id: anonId,
    daily_challenge_id: dailyChallengeId ?? null,
    difficulty: "easy",
    total_events: 1,
  });

  if (sessionError) {
    throw new Error(`No se pudo iniciar la partida: ${sessionError.message}`);
  }

  return sessionId;
}
