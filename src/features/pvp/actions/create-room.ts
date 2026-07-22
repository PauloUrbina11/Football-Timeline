"use server";

import { resolveCaller } from "./resolve-caller";

export interface CreateRoomResult {
  status: "waiting";
  queueId: string;
  roomCode: string;
}

/** Crea una sala privada con código para compartir — ver create_pvp_room en 0024. */
export async function createPvpRoom(guestAlias?: string): Promise<CreateRoomResult> {
  const { supabase, anonId } = await resolveCaller();

  const { data, error } = await supabase.rpc("create_pvp_room", {
    p_guest_alias: guestAlias ?? null,
    p_anon_id: anonId,
  });

  if (error || !data) {
    throw new Error(`No se pudo crear la sala: ${error?.message ?? "sin respuesta"}`);
  }

  return data as CreateRoomResult;
}
