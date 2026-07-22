"use server";

import { resolveCaller } from "./resolve-caller";
import type { PvpMatchState } from "@/features/pvp/domain/types";

/**
 * Intenta avanzar el juego actual de un match: no-op si nada cambió, fuerza el cierre (0 puntos)
 * de quien no terminó a tiempo si el plazo ya expiró, y activa el siguiente juego o finaliza el
 * match si ambos ya tienen resultado. Ver advance_pvp_game en supabase/migrations/0021 — es
 * seguro llamarla repetidamente (idempotente) desde un `setTimeout` sincronizado a `endsAt`.
 */
export async function advancePvpGame(matchId: string, gameIndex: number): Promise<PvpMatchState> {
  const { supabase, anonId } = await resolveCaller();

  const { data, error } = await supabase.rpc("advance_pvp_game", {
    p_match_id: matchId,
    p_game_index: gameIndex,
    p_anon_id: anonId,
  });

  if (error || !data) {
    throw new Error(`No se pudo avanzar la partida: ${error?.message ?? "sin respuesta"}`);
  }

  return data as PvpMatchState;
}
