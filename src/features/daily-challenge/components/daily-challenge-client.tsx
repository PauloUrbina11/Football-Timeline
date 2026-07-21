"use client";

import { useEffect, useRef, useState } from "react";
import { getTodayChallenge, type TodayChallengeAlreadyPlayed } from "@/features/daily-challenge/actions/get-today-challenge";
import { startSession } from "@/features/game-engine/actions/start-session";
import { TimelineBoard } from "@/features/game-engine/components/board/timeline-board";
import { getGameMode } from "@/features/game-engine/domain/modes-registry";
import type { EventCardData } from "@/features/game-engine/domain/types";
import { AlreadyPlayedSummary } from "./already-played-summary";
import { DailyResult } from "./daily-result";

type State =
  | { status: "loading" }
  | { status: "already_played"; data: TodayChallengeAlreadyPlayed }
  | {
      status: "playing";
      sessionId: string;
      cards: EventCardData[];
      timelineTitle: string;
      challengeDateISO: string;
      modeId: string;
    }
  | { status: "error"; message: string };

export function DailyChallengeClient() {
  const [state, setState] = useState<State>({ status: "loading" });
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Ver la nota en daily-result.tsx: sin guarda de "isMounted" a propósito.
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    getTodayChallenge()
      .then(async (result) => {
        if (result.status === "already_played") {
          setState({ status: "already_played", data: result });
          return;
        }
        const { sessionId, cards } = await startSession(result.timelineId, result.challengeId);
        setState({
          status: "playing",
          sessionId,
          cards,
          timelineTitle: result.timelineTitle,
          challengeDateISO: result.challengeDateISO,
          modeId: result.modeId,
        });
      })
      .catch((error: unknown) => {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "No se pudo cargar el reto diario.",
        });
      });
  }, []);

  if (state.status === "loading") {
    return <p className="text-muted">Cargando reto diario…</p>;
  }

  if (state.status === "error") {
    return <p className="text-danger">{state.message}</p>;
  }

  if (state.status === "already_played") {
    return <AlreadyPlayedSummary data={state.data} />;
  }

  const mode = getGameMode(state.modeId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        {mode && (
          <p className="text-sm text-muted">
            {mode.icon} {mode.name}
          </p>
        )}
        <h2 className="text-xl font-semibold text-foreground">{state.timelineTitle}</h2>
      </div>
      <TimelineBoard
        sessionId={state.sessionId}
        initialCards={state.cards}
        timelineTitle={state.timelineTitle}
        renderResult={({ score, attempts, elapsedMs }) => (
          <DailyResult
            sessionId={state.sessionId}
            challengeDateISO={state.challengeDateISO}
            score={score}
            attempts={attempts}
            elapsedMs={elapsedMs}
          />
        )}
      />
    </div>
  );
}
