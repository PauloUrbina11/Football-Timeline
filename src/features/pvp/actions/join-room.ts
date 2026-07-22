"use server";

import { resolveCaller } from "./resolve-caller";

export interface JoinRoomResult {
  status: "matched";
  matchId: string;
}

/** Se une a una sala privada existente por código — ver join_pvp_room en 0024. */
export async function joinPvpRoom(code: string, guestAlias?: string): Promise<JoinRoomResult> {
  const { supabase, anonId } = await resolveCaller();

  const { data, error } = await supabase.rpc("join_pvp_room", {
    p_code: code,
    p_guest_alias: guestAlias ?? null,
    p_anon_id: anonId,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo unir a la sala.");
  }

  return data as JoinRoomResult;
}
