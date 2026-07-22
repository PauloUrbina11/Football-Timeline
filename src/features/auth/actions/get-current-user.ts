"use server";

import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

/** `null` si nadie inició sesión (invitado) — el resto de la app sigue funcionando igual. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: profile } = await supabase.from("profiles").select("display_name, username").eq("id", data.user.id).maybeSingle();

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    displayName: profile?.display_name ?? profile?.username ?? null,
  };
}
