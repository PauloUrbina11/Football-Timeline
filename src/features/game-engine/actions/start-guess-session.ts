"use server";

import { createClient } from "@/lib/supabase/server";
import { createGameSession } from "@/features/game-engine/actions/create-game-session";

export interface StartGuessSessionResult {
  sessionId: string;
}

/**
 * Variante de `startSession` para el modo "guess" (ver modes-registry.ts): no hay tarjetas que
 * mostrar, solo confirma que el timeline tiene un reto configurado (`get_guess_target` nunca
 * devuelve el valor real, solo el event_id, y ni siquiera hace falta en el cliente) y arranca la
 * sesión. El valor secreto vive en `event_secret_values`, protegida por RLS (ver 0013_guess_mode.sql).
 */
export async function startGuessSession(
  timelineId: string,
  dailyChallengeId?: string,
  pvpMatchGameId?: string,
): Promise<StartGuessSessionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_guess_target", { p_timeline_id: timelineId });

  if (error) {
    throw new Error(`No se pudo cargar el timeline: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error("Este timeline no tiene un reto configurado todavía.");
  }

  const sessionId = await createGameSession(timelineId, dailyChallengeId, pvpMatchGameId);

  return { sessionId };
}
