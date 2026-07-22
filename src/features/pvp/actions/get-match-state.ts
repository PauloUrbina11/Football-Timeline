"use server";

import { resolveCaller } from "./resolve-caller";
import type { PvpMatchState } from "@/features/pvp/domain/types";

export async function getPvpMatchState(matchId: string): Promise<PvpMatchState> {
  const { supabase, anonId } = await resolveCaller();

  const { data, error } = await supabase.rpc("get_pvp_match_state", { p_match_id: matchId, p_anon_id: anonId });
  if (error || !data) {
    throw new Error(`No se pudo cargar la partida: ${error?.message ?? "sin respuesta"}`);
  }

  return data as PvpMatchState;
}
