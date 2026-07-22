"use server";

import { createClient } from "@/lib/supabase/server";

export async function signIn(email: string, password: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error("Email o contraseña incorrectos.");
  }
}
