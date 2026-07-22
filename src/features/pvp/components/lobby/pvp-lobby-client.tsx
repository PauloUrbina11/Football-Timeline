"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { usePvpQueue } from "@/features/pvp/hooks/use-pvp-queue";
import { getPvpIdentity } from "@/features/pvp/actions/get-identity";
import { getActivePvpMatch } from "@/features/pvp/actions/get-active-match";

export function PvpLobbyClient() {
  const router = useRouter();
  const { status, matchId, errorMessage, search, cancel } = usePvpQueue();
  const [alias, setAlias] = useState("");
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [checkingReconnect, setCheckingReconnect] = useState(true);

  useEffect(() => {
    getPvpIdentity().then((identity) => setIsGuest(identity.userId === null));
  }, []);

  // Reconexión: si ya hay un match activo (recarga, o volviste después de cerrar la pestaña),
  // se entra directo a él en vez de mostrar el lobby de búsqueda.
  useEffect(() => {
    getActivePvpMatch()
      .then((activeMatchId) => {
        if (activeMatchId) router.replace(`/pvp/match/${activeMatchId}`);
      })
      .finally(() => setCheckingReconnect(false));
  }, [router]);

  useEffect(() => {
    if (matchId) router.push(`/pvp/match/${matchId}`);
  }, [matchId, router]);

  if (checkingReconnect || isGuest === null) {
    return <p className="text-muted">Cargando…</p>;
  }

  if (status === "searching" || status === "matched") {
    return (
      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        <CardTitle>Buscando rival…</CardTitle>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden="true" />
        <Button variant="secondary" onClick={() => void cancel()}>
          Cancelar búsqueda
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex w-full max-w-md flex-col gap-4">
      <CardTitle>PvP Online</CardTitle>
      <CardDescription>
        Enfréntate a otro jugador en 3 juegos elegidos al azar, sin repetir modo. Si ambos están registrados, la
        partida es <strong className="text-foreground">Oficial</strong> y afecta tu Rating; si alguno juega como
        invitado, es <strong className="text-foreground">Amistosa</strong> (se juega igual, pero no afecta ranking).
      </CardDescription>
      {isGuest && (
        <input
          type="text"
          required
          maxLength={24}
          placeholder="Tu alias para esta partida"
          value={alias}
          onChange={(event) => setAlias(event.target.value)}
          className="h-11 rounded-lg border border-border bg-surface px-4 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      )}
      {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}
      <Button onClick={() => void search(isGuest ? alias : undefined)} disabled={isGuest && alias.trim().length === 0}>
        Buscar partida
      </Button>
      <Link href="/pvp/rankings" className="text-center text-sm text-muted hover:text-foreground">
        Ver rankings
      </Link>
    </Card>
  );
}
