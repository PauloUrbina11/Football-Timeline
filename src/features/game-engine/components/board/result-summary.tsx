import { StarRating } from "@/components/ui/star-rating";
import { Card, CardTitle } from "@/components/ui/card";
import type { Stars } from "@/features/game-engine/domain/scoring";
import { formatElapsed } from "@/features/game-engine/domain/format-elapsed";

export interface ResultSummaryProps {
  timelineTitle: string;
  totalEvents: number;
  attempts: number;
  elapsedMs: number;
  points: number;
  stars: Stars;
}

export function ResultSummary({ timelineTitle, totalEvents, attempts, elapsedMs, points, stars }: ResultSummaryProps) {
  return (
    <Card data-testid="result-summary" className="flex flex-col items-center gap-4 py-10 text-center">
      <CardTitle>{timelineTitle}</CardTitle>
      <p className="text-lg font-semibold text-foreground">
        {totalEvents}/{totalEvents} correcto
      </p>
      <StarRating stars={stars} className="text-2xl" />
      <p className="text-muted">{points} puntos</p>
      <dl className="mt-2 grid grid-cols-2 gap-8 text-sm text-muted">
        <div>
          <dt>Tiempo</dt>
          <dd className="text-base font-medium text-foreground">{formatElapsed(elapsedMs)}</dd>
        </div>
        <div>
          <dt>Intentos</dt>
          <dd className="text-base font-medium text-foreground">{attempts}</dd>
        </div>
      </dl>
    </Card>
  );
}
