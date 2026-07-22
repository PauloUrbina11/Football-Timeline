"use server";

import { createClient } from "@/lib/supabase/server";

export interface SignUpResult {
  needsEmailConfirmation: boolean;
}

/**
 * Registro mínimo por email+contraseña. `handle_new_user` (trigger ya existente, ver
 * supabase/migrations/0002_rls_policies.sql) crea el `profile` correspondiente automáticamente —
 * esta action no toca la tabla `profiles` directamente.
 */
export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    throw new Error(error.message);
  }

  return { needsEmailConfirmation: data.session === null };
}
