"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUser, type CurrentUser } from "@/features/auth/actions/get-current-user";
import { signOut } from "@/features/auth/actions/sign-out";

/** Pequeño indicador de sesión — invitado por defecto, sin bloquear nada mientras carga. */
export function AuthStatus() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  if (user === undefined) {
    return null;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <a href="/login" className="text-muted hover:text-foreground">
          Iniciar sesión
        </a>
        <a href="/signup" className="text-primary hover:underline">
          Registrarse
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted">Hola, {user.displayName ?? user.email}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void signOut().then(() => {
            router.push("/");
            router.refresh();
          });
        }}
      >
        Salir
      </Button>
    </div>
  );
}
