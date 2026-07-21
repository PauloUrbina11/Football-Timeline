/**
 * Placeholder hasta que exista un proyecto Supabase real.
 * Una vez aplicadas las migraciones (ver supabase/migrations), regenerar con:
 *
 *   npx supabase gen types typescript --project-id <tu-project-id> --schema public > src/types/database.types.ts
 *
 * y parametrizar los clientes de src/lib/supabase/*.ts con `createClient<Database>(...)`.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
