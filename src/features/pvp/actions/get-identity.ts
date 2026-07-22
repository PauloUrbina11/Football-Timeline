"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrCreateAnonId } from "@/lib/anon-id";

export interface PvpIdentity {
  userId: string | null;
  /**
   * Solo se expone al cliente porque no es un secreto (no autentica nada, solo identifica una
   * fila de invitado — ver src/lib/anon-id.ts); el hook de Realtime lo necesita para saber cuál
   * fila de `pvp_queue`/`pvp_match_players` es "mía" sin depender de auth.uid().
   */
  anonId: string | null;
  displayName: string | null;
}

export async function getPvpIdentity(): Promise<PvpIdentity> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", data.user.id)
      .maybeSingle();

    return {
      userId: data.user.id,
      anonId: null,
      displayName: profile?.display_name ?? profile?.username ?? null,
    };
  }

  const anonId = await getOrCreateAnonId();
  return { userId: null, anonId, displayName: null };
}
