"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";
import { formatElapsed } from "@/features/game-engine/domain/format-elapsed";
import type { Stars } from "@/features/game-engine/domain/scoring";
import { submitDailyResult } from "@/features/daily-challenge/actions/submit-daily-result";
import { formatShareText } from "@/features/daily-challenge/domain/share-encoding";
import { ShareGrid } from "./share-grid";
import { ShareButton } from "./share-button";

export interface DailyResultProps {
  sessionId: string;
  challengeDateISO: string;
  score: { points: number; stars: Stars };
  attempts: number;
  elapsedMs: number;
}

/** Se muestra justo después de resolver el reto: persiste el resultado compartible y lo despliega. */
export function DailyResult({ sessionId, challengeDateISO, score, attempts, elapsedMs }: DailyResultProps) {
  const [share, setShare] = useState<{ resultGrid: string; shareUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    // Evita una segunda llamada concurrente (p. ej. la doble invocación de efectos de React en
    // desarrollo): el RPC ya es idempotente, pero no tiene sentido pagar dos ida y vuelta de red.
    // Deliberadamente SIN guarda de "isMounted": React (Strict Mode) simula un unmount/remount
    // del efecto sin desmontar el componente de verdad, así que esa guarda descartaría la
    // respuesta de la primera llamada aunque el componente siga en pantalla. Actualizar el
    // estado de un componente realmente desmontado es un no-op seguro en React 18+.
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    submitDailyResult(sessionId)
      .then((result) => setShare({ resultGrid: result.resultGrid, shareUrl: result.shareUrl }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudo guardar el resultado."));
  }, [sessionId]);

  return (
    <Card data-testid="daily-result" className="flex flex-col items-center gap-4 py-10 text-center">
      <CardTitle>Reto diario resuelto</CardTitle>
      <StarRating stars={score.stars} className="text-2xl" />
      <p className="text-muted">{score.points} puntos</p>
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

      {error && <p className="text-sm text-danger">{error}</p>}
      {!error && !share && <p className="text-sm text-muted">Guardando resultado…</p>}
      {share && (
        <div className="flex flex-col items-center gap-4">
          <ShareGrid grid={share.resultGrid} />
          <ShareButton
            text={formatShareText({
              challengeDateISO,
              resultGrid: share.resultGrid,
              timeMs: elapsedMs,
              stars: score.stars,
              shareUrl: share.shareUrl,
            })}
          />
        </div>
      )}
    </Card>
  );
}
