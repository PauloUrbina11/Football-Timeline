"use server";

import { resolveCaller } from "./resolve-caller";
import type { PvpMatchState } from "@/features/pvp/domain/types";

/**
 * Se llama justo cuando `finishSession`/`finishGuessSession` (RPC del propio modo, sin cambios)
 * ya resolvió la sesión — copia el puntaje que `scores` ya calculó hacia el Match Engine, nunca
 * lo recalcula. Ver report_pvp_game_result en supabase/migrations/0021.
 */
export async function reportPvpGameResult(sessionId: string): Promise<PvpMatchState> {
  const { supabase, anonId } = await resolveCaller();

  const { data, error } = await supabase.rpc("report_pvp_game_result", {
    p_session_id: sessionId,
    p_anon_id: anonId,
  });

  if (error || !data) {
    throw new Error(`No se pudo reportar el resultado: ${error?.message ?? "sin respuesta"}`);
  }

  return data as PvpMatchState;
}
