"use server";

import { resolveCaller } from "./resolve-caller";

export interface FindMatchResult {
  status: "matched" | "waiting";
  matchId?: string;
  queueId?: string;
}

/**
 * Entra a la cola de matchmaking (o recupera la fila propia si ya estaba esperando) y trata de
 * emparejar de inmediato — ver `enqueue_pvp_match` en supabase/migrations/0021. `guestAlias` solo
 * se usa (y se exige) si quien llama es un invitado.
 */
export async function findPvpMatch(guestAlias?: string): Promise<FindMatchResult> {
  const { supabase, anonId } = await resolveCaller();

  const { data, error } = await supabase.rpc("enqueue_pvp_match", {
    p_guest_alias: guestAlias ?? null,
    p_anon_id: anonId,
  });

  if (error) {
    throw new Error(`No se pudo buscar partida: ${error.message}`);
  }

  return data as FindMatchResult;
}
