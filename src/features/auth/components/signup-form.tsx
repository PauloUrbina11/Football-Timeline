"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { signUp } from "@/features/auth/actions/sign-up";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await signUp(email, password);
      if (result.needsEmailConfirmation) {
        setNeedsConfirmation(true);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (needsConfirmation) {
    return (
      <Card className="flex w-full max-w-sm flex-col gap-2">
        <CardTitle>Revisa tu email</CardTitle>
        <CardDescription>Te enviamos un enlace para confirmar tu cuenta antes de poder iniciar sesión.</CardDescription>
      </Card>
    );
  }

  return (
    <Card className="flex w-full max-w-sm flex-col gap-4">
      <CardTitle>Crear cuenta</CardTitle>
      <CardDescription>
        El registro solo agrega historial, estadísticas y ranking permanentes — puedes seguir jugando todos los modos
        (incluido PvP) sin registrarte.
      </CardDescription>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 rounded-lg border border-border bg-surface px-4 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Contraseña (mínimo 6 caracteres)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11 rounded-lg border border-border bg-surface px-4 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
      <p className="text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <a href="/login" className="text-primary hover:underline">
          Inicia sesión
        </a>
      </p>
    </Card>
  );
}
