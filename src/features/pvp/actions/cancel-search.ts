"use server";

import { resolveCaller } from "./resolve-caller";

export async function cancelPvpSearch(): Promise<void> {
  const { supabase, anonId } = await resolveCaller();

  const { error } = await supabase.rpc("cancel_pvp_search", { p_anon_id: anonId });
  if (error) {
    throw new Error(`No se pudo cancelar la búsqueda: ${error.message}`);
  }
}
