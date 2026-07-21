"use server";

import { createClient } from "@/lib/supabase/server";

export interface SubmitAttemptResult {
  correctPositions: boolean[];
  correctCount: number;
  isFullyCorrect: boolean;
}

interface SubmitAttemptRow {
  correct_positions: boolean[];
  correct_count: number;
  is_fully_correct: boolean;
}

/** Verifica un intento vía el RPC `submit_attempt` (security definer): nunca recibe el orden correcto. */
export async function submitAttempt(sessionId: string, submittedOrder: string[]): Promise<SubmitAttemptResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("submit_attempt", { p_session_id: sessionId, p_submitted_order: submittedOrder })
    .single();

  if (error || !data) {
    throw new Error(`No se pudo comprobar el intento: ${error?.message ?? "sin respuesta"}`);
  }

  const row = data as SubmitAttemptRow;
  return {
    correctPositions: row.correct_positions,
    correctCount: row.correct_count,
    isFullyCorrect: row.is_fully_correct,
  };
}
