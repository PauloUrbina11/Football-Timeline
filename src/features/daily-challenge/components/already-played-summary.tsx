import { Card, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";
import { formatElapsed } from "@/features/game-engine/domain/format-elapsed";
import { formatShareText } from "@/features/daily-challenge/domain/share-encoding";
import type { TodayChallengeAlreadyPlayed } from "@/features/daily-challenge/actions/get-today-challenge";
import { ShareGrid } from "./share-grid";
import { ShareButton } from "./share-button";

export function AlreadyPlayedSummary({ data }: { data: TodayChallengeAlreadyPlayed }) {
  return (
    <Card data-testid="already-played-summary" className="flex flex-col items-center gap-4 py-10 text-center">
      <CardTitle>Ya jugaste el reto de hoy</CardTitle>
      <p className="text-sm text-muted">Vuelve mañana para un timeline nuevo.</p>
      <StarRating stars={data.stars} className="text-2xl" />
      <p className="text-muted">{data.points} puntos</p>
      <dl className="mt-2 grid grid-cols-2 gap-8 text-sm text-muted">
        <div>
          <dt>Tiempo</dt>
          <dd className="text-base font-medium text-foreground">{formatElapsed(data.timeMs)}</dd>
        </div>
        <div>
          <dt>Intentos</dt>
          <dd className="text-base font-medium text-foreground">{data.attempts}</dd>
        </div>
      </dl>
      <ShareGrid grid={data.resultGrid} />
      <ShareButton
        text={formatShareText({
          challengeDateISO: data.challengeDateISO,
          resultGrid: data.resultGrid,
          timeMs: data.timeMs,
          stars: data.stars,
          shareUrl: data.shareUrl,
        })}
      />
    </Card>
  );
}
