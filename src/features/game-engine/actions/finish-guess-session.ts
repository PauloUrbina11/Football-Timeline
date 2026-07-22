"use server";

import { createClient } from "@/lib/supabase/server";
import type { Stars } from "@/features/game-engine/domain/guess-scoring";

export interface FinishGuessSessionResult {
  points: number;
  stars: Stars;
  actualValueEur: number;
}

interface FinishGuessSessionRow {
  points: number;
  stars: Stars;
  actual_value_eur: number;
}

/**
 * Cierra la sesión de un modo "guess" vía `finish_guess_session`. A diferencia de `finish_session`,
 * siempre revela `actualValueEur` al terminar (acertado o abandonado) — es la única forma en que el
 * jugador se entera del valor real si decide rendirse.
 */
export async function finishGuessSession(sessionId: string, abandon = false): Promise<FinishGuessSessionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("finish_guess_session", { p_session_id: sessionId, p_abandon: abandon })
    .single();

  if (error || !data) {
    throw new Error(`No se pudo finalizar la partida: ${error?.message ?? "sin respuesta"}`);
  }

  const row = data as FinishGuessSessionRow;
  return { points: row.points ?? 0, stars: row.stars ?? 1, actualValueEur: row.actual_value_eur };
}
