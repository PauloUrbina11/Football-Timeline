import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PvpMatchState } from "@/features/pvp/domain/types";

export function FinalResultScreen({ state }: { state: PvpMatchState }) {
  const me = state.players.find((player) => player.isMe);
  const opponent = state.players.find((player) => !player.isMe);
  const isDraw = state.winnerMatchPlayerId === null;
  const iWon = !!me && state.winnerMatchPlayerId === me.matchPlayerId;
  const totalTimeMs = state.games.reduce((sum, game) => sum + (game.myResult?.timeMs ?? 0), 0);

  return (
    <Card className="flex flex-col items-center gap-6 py-10 text-center">
      <Badge variant={state.isOfficial ? "accent" : "outline"}>{state.isOfficial ? "Partida Oficial" : "Partida Amistosa"}</Badge>
      <CardTitle className="text-2xl">
        {state.status === "cancelled" ? "Partida anulada" : isDraw ? "¡Empate!" : iWon ? "¡Ganaste!" : "Derrota"}
      </CardTitle>

      {me && opponent && (
        <div className="grid w-full grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-muted">{me.displayName} (tú)</p>
            <p className="text-3xl font-bold text-foreground">{me.totalPoints}</p>
            {me.ratingDelta !== null && (
              <p className={me.ratingDelta >= 0 ? "text-primary" : "text-danger"}>
                {me.ratingDelta >= 0 ? "+" : ""}
                {me.ratingDelta} Rating
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted">{opponent.displayName}</p>
            <p className="text-3xl font-bold text-foreground">{opponent.totalPoints}</p>
            {opponent.ratingDelta !== null && (
              <p className={opponent.ratingDelta >= 0 ? "text-primary" : "text-danger"}>
                {opponent.ratingDelta >= 0 ? "+" : ""}
                {opponent.ratingDelta} Rating
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex w-full flex-col gap-2">
        {state.games.map((game) => (
          <div key={game.gameIndex} className="flex items-center justify-between rounded-lg border border-border px-4 py-2 text-sm">
            <span className="text-muted">Juego {game.gameIndex + 1}</span>
            <span className="font-medium text-foreground">
              {game.myResult?.points ?? 0} — {game.opponentResult?.points ?? 0}
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted">Tiempo total: {Math.round(totalTimeMs / 1000)}s</p>

      <Link href="/pvp">
        <Button>Volver al lobby</Button>
      </Link>
    </Card>
  );
}
