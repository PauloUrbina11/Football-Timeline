"use server";

import { resolveCaller } from "./resolve-caller";

/** Para reconexión: ¿ya participo en un match activo? Ver get_my_active_pvp_match (0021). */
export async function getActivePvpMatch(): Promise<string | null> {
  const { supabase, anonId } = await resolveCaller();

  const { data, error } = await supabase.rpc("get_my_active_pvp_match", { p_anon_id: anonId });
  if (error) {
    throw new Error(`No se pudo comprobar la partida activa: ${error.message}`);
  }

  const rows = (data ?? []) as { match_id: string }[];
  return rows[0]?.match_id ?? null;
}
