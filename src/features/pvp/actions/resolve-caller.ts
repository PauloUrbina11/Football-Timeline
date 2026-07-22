import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateAnonId } from "@/lib/anon-id";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helper compartido (no es una Server Action en sí — sin "use server") por todas las actions de
 * `features/pvp/actions`: resuelve el cliente de Supabase y el `anon_id` a pasar como parámetro a
 * las RPCs del Match Engine cuando quien llama es un invitado (mismo patrón que
 * `create-game-session.ts` ya usa para el resto del juego).
 */
export async function resolveCaller(): Promise<{ supabase: SupabaseClient; anonId: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const anonId = data.user ? null : await getOrCreateAnonId();
  return { supabase, anonId };
}
