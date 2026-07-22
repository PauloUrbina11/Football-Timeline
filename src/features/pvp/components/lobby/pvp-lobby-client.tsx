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
  const { status, matchId, roomCode, errorMessage, search, createRoom, joinRoom, cancel } = usePvpQueue();
  const [alias, setAlias] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [checkingReconnect, setCheckingReconnect] = useState(true);
  const [copied, setCopied] = useState(false);

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

  if (status === "searching" && roomCode) {
    return (
      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        <CardTitle>Sala creada</CardTitle>
        <CardDescription>Comparte este código con tu rival — en cuanto se una, empieza el duelo.</CardDescription>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(roomCode).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="rounded-xl border border-dashed border-primary bg-surface px-6 py-3 text-3xl font-bold tracking-widest text-primary"
        >
          {roomCode}
        </button>
        {copied && <p className="text-sm text-primary">Código copiado</p>}
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden="true" />
        <Button variant="secondary" onClick={() => void cancel()}>
          Cancelar sala
        </Button>
      </Card>
    );
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

  const guestAlias = isGuest ? alias : undefined;
  const aliasMissing = isGuest && alias.trim().length === 0;

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

      <Button onClick={() => void search(guestAlias)} disabled={aliasMissing}>
        Buscar partida al azar
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="secondary" onClick={() => void createRoom(guestAlias)} disabled={aliasMissing}>
        Crear sala privada
      </Button>

      <div className="flex gap-2">
        <input
          type="text"
          maxLength={6}
          placeholder="Código de sala"
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          className="h-11 flex-1 rounded-lg border border-border bg-surface px-4 text-center font-mono uppercase tracking-widest text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <Button
          variant="secondary"
          onClick={() => void joinRoom(joinCode, guestAlias)}
          disabled={aliasMissing || joinCode.trim().length === 0}
        >
          Unirse
        </Button>
      </div>

      <Link href="/pvp/rankings" className="text-center text-sm text-muted hover:text-foreground">
        Ver rankings
      </Link>
    </Card>
  );
}
