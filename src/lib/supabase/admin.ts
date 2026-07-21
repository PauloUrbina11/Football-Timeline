import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";

/**
 * Cliente con la clave `service_role`: hace bypass de RLS por completo.
 * Uso exclusivo en rutas de servidor ya protegidas por rol admin (ver src/app/admin).
 * Nunca importar este módulo desde un Client Component ni desde código compartido con el cliente.
 */
export function createAdminClient() {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();

  return createSupabaseClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
