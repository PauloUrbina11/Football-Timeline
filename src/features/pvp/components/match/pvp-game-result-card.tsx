import { Card, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";
import type { PvpMatchState } from "@/features/pvp/domain/types";

export interface PvpGameResultCardProps {
  gameIndex: number;
  points: number | null;
  stars: 1 | 2 | 3 | 4 | 5 | null;
  gaveUp?: boolean;
  matchState: PvpMatchState;
  error: string | null;
}

/** Se muestra al terminar CADA juego del duelo — nunca calcula puntos, solo los que ya llegaron. */
export function PvpGameResultCard({ gameIndex, points, stars, gaveUp, matchState, error }: PvpGameResultCardProps) {
  const game = matchState.games.find((entry) => entry.gameIndex === gameIndex);
  const opponentResult = game?.opponentResult ?? null;

  return (
    <Card data-testid="pvp-game-result" className="flex flex-col items-center gap-4 py-10 text-center">
      <CardTitle>
        Juego {gameIndex + 1} de {matchState.totalGames}
      </CardTitle>
      {gaveUp ? (
        <p className="text-muted">Te rendiste — 0 puntos en este juego.</p>
      ) : (
        <>
          {stars && <StarRating stars={stars} className="text-2xl" animate />}
          <p className="text-muted">{points ?? 0} puntos</p>
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {opponentResult ? (
        <p className="text-sm text-foreground">Tu rival hizo {opponentResult.points} puntos en este juego.</p>
      ) : (
        <p className="text-sm text-muted" aria-live="polite">
          Esperando a que tu rival termine…
        </p>
      )}
    </Card>
  );
}
