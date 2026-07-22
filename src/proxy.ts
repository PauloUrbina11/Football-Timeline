import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

/**
 * Refresca la sesión de Supabase en cada request (equivalente a `middleware.ts` en versiones
 * anteriores de Next.js — ver docs/architecture.md). Sin esto, un token expirado solo se
 * refrescaría la próxima vez que un Server Component llamara a `createClient()`, lo que puede
 * quedar "un paso atrás" de lo que ve el navegador. No implementa ninguna regla de autorización
 * por ruta (eso sigue viviendo en cada layout/Server Action, ver `data-security.md` de Next.js):
 * su único trabajo es mantener las cookies de sesión al día.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/og).*)"],
};
