import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Usa la clave `anon` + cookies de sesión, sujeto a RLS (nunca hace bypass de seguridad).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Ignorable: ocurre al llamar desde un Server Component sin poder escribir cookies.
          // La sesión se refresca de todos modos en `proxy.ts` (Fase 4).
        }
      },
    },
  });
}
