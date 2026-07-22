"use client";

import { useEffect, useRef, useState } from "react";
import { reportPvpGameResult } from "@/features/pvp/actions/report-game-result";
import type { PvpMatchState } from "@/features/pvp/domain/types";

/**
 * Reporta UNA vez el resultado ya calculado por el modo (`finishSession`/`finishGuessSession`,
 * incluso al abandonar — ver report_pvp_game_result en 0021) al Match Engine. No calcula nada:
 * solo dispara el reporte cuando el board correspondiente ya terminó.
 */
export function useReportPvpResult(sessionId: string, onReported: (state: PvpMatchState) => void) {
  const [error, setError] = useState<string | null>(null);
  const hasReportedRef = useRef(false);

  useEffect(() => {
    if (hasReportedRef.current) return;
    hasReportedRef.current = true;
    reportPvpGameResult(sessionId)
      .then(onReported)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudo reportar el resultado."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return { error };
}
