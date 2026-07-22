"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { signIn } from "@/features/auth/actions/sign-in";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="flex w-full max-w-sm flex-col gap-4">
      <CardTitle>Iniciar sesión</CardTitle>
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
          placeholder="Contraseña"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11 rounded-lg border border-border bg-surface px-4 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <a href="/signup" className="text-primary hover:underline">
          Regístrate
        </a>
      </p>
    </Card>
  );
}
