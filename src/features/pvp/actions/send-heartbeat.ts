"use server";

import { resolveCaller } from "./resolve-caller";

/** Latido de presencia (~cada 15s mientras hay un match activo) — ver pvp_heartbeat en 0021. */
export async function sendPvpHeartbeat(matchId: string): Promise<void> {
  const { supabase, anonId } = await resolveCaller();

  const { error } = await supabase.rpc("pvp_heartbeat", { p_match_id: matchId, p_anon_id: anonId });
  if (error) {
    throw new Error(`No se pudo enviar el latido de presencia: ${error.message}`);
  }
}
