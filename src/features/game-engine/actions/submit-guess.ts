"use server";

import { createClient } from "@/lib/supabase/server";
import type { GuessResult } from "@/features/game-engine/domain/types";

export interface SubmitGuessResult {
  result: GuessResult;
  attemptNumber: number;
  isCorrect: boolean;
}

interface SubmitGuessRow {
  result: GuessResult;
  attempt_number: number;
  is_correct: boolean;
}

/** Verifica un intento vía `check_guess_attempt` (security definer): nunca recibe el valor real, salvo que el intento sea exacto. */
export async function submitGuess(sessionId: string, guessValueEur: number): Promise<SubmitGuessResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("check_guess_attempt", { p_session_id: sessionId, p_guess_eur: guessValueEur })
    .single();

  if (error || !data) {
    throw new Error(`No se pudo comprobar el intento: ${error?.message ?? "sin respuesta"}`);
  }

  const row = data as SubmitGuessRow;
  return { result: row.result, attemptNumber: row.attempt_number, isCorrect: row.is_correct };
}
