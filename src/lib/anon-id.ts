import "server-only";
import { cookies } from "next/headers";

const ANON_ID_COOKIE = "ft_anon_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Identificador de invitado persistido en una cookie httpOnly, usado para partidas sin sesión
 * iniciada. Protección "best-effort" (documentada en docs/architecture.md): un usuario puede
 * borrar cookies y perder su progreso de invitado, pero no puede falsificar el de otra persona
 * sin conocer un `session_id` ajeno.
 */
export async function getOrCreateAnonId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(ANON_ID_COOKIE)?.value;
  if (existing) {
    return existing;
  }

  const anonId = crypto.randomUUID();
  cookieStore.set(ANON_ID_COOKIE, anonId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return anonId;
}
