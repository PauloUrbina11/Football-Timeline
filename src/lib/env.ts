import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida de tu proyecto Supabase." }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, { error: "NEXT_PUBLIC_SUPABASE_ANON_KEY es obligatoria." }),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, {
    error: "SUPABASE_SERVICE_ROLE_KEY es obligatoria para operaciones de administrador (server-only, nunca expuesta al cliente).",
  }),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedPublicEnv: PublicEnv | undefined;
let cachedServerEnv: ServerEnv | undefined;

/**
 * Validación perezosa: solo se ejecuta cuando algo intenta realmente hablar con Supabase
 * (ver lib/supabase/*.ts), así el resto de la app (páginas sin datos aún) sigue funcionando
 * en local antes de que exista un proyecto Supabase configurado.
 */
export function getPublicEnv(): PublicEnv {
  if (!cachedPublicEnv) {
    const parsed = publicEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    });
    if (!parsed.success) {
      throw new Error(formatEnvError("públicas", parsed.error));
    }
    cachedPublicEnv = parsed.data;
  }
  return cachedPublicEnv;
}

export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    const parsed = serverEnvSchema.safeParse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    if (!parsed.success) {
      throw new Error(formatEnvError("de servidor", parsed.error));
    }
    cachedServerEnv = parsed.data;
  }
  return cachedServerEnv;
}

function formatEnvError(kind: string, error: z.ZodError): string {
  const issues = error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
  return `Variables de entorno ${kind} inválidas o ausentes. Copia .env.example a .env.local y complétalas:\n${issues}`;
}
