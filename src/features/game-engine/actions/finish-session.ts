"use server";

import { createClient } from "@/lib/supabase/server";
import type { Stars } from "@/features/game-engine/domain/scoring";

export interface FinishSessionResult {
  points: number;
  stars: Stars;
}

interface FinishSessionRow {
  points: number;
  stars: Stars;
}

/**
 * Cierra la sesión y persiste la puntuación vía el RPC `finish_session`. Solo tiene éxito si la
 * sesión ya está completamente resuelta (`correct_count = total_events`) según el propio servidor.
 */
export async function finishSession(sessionId: string): Promise<FinishSessionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("finish_session", { p_session_id: sessionId }).single();

  if (error || !data) {
    throw new Error(`No se pudo finalizar la partida: ${error?.message ?? "sin respuesta"}`);
  }

  const row = data as FinishSessionRow;
  return { points: row.points, stars: row.stars };
}
