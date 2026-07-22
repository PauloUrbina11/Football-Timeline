"use client";

import { useEffect, useRef, useState } from "react";
import { getTodayChallenge, type TodayChallengeAlreadyPlayed } from "@/features/daily-challenge/actions/get-today-challenge";
import { startSession } from "@/features/game-engine/actions/start-session";
import { startMatchSession } from "@/features/game-engine/actions/start-match-session";
import { TimelineBoard } from "@/features/game-engine/components/board/timeline-board";
import { MatchBoard } from "@/features/game-engine/components/board/match-board";
import { getGameMode } from "@/features/game-engine/domain/modes-registry";
import type { EventCardData, MatchCardData, SlotLabel } from "@/features/game-engine/domain/types";
import { AlreadyPlayedSummary } from "./already-played-summary";
import { DailyResult } from "./daily-result";

type State =
  | { status: "loading" }
  | { status: "already_played"; data: TodayChallengeAlreadyPlayed }
  | {
      status: "playing-sort";
      sessionId: string;
      cards: EventCardData[];
      timelineTitle: string;
      challengeDateISO: string;
      modeId: string;
    }
  | {
      status: "playing-match";
      sessionId: string;
      items: MatchCardData[];
      slots: SlotLabel[];
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
        const mode = getGameMode(result.modeId);
        if (mode?.interaction === "match") {
          const { sessionId, items, slots } = await startMatchSession(result.timelineId, result.challengeId);
          setState({
            status: "playing-match",
            sessionId,
            items,
            slots,
            timelineTitle: result.timelineTitle,
            challengeDateISO: result.challengeDateISO,
            modeId: result.modeId,
          });
          return;
        }
        const { sessionId, cards } = await startSession(result.timelineId, result.challengeId);
        setState({
          status: "playing-sort",
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
  const header = (
    <div>
      {mode && (
        <p className="text-sm text-muted">
          {mode.icon} {mode.name}
        </p>
      )}
      <h2 className="text-xl font-semibold text-foreground">{state.timelineTitle}</h2>
    </div>
  );

  const renderDailyResult = ({
    score,
    attempts,
    elapsedMs,
  }: {
    score: { points: number; stars: 1 | 2 | 3 | 4 | 5 };
    attempts: number;
    elapsedMs: number;
  }) => (
    <DailyResult
      sessionId={state.sessionId}
      challengeDateISO={state.challengeDateISO}
      score={score}
      attempts={attempts}
      elapsedMs={elapsedMs}
    />
  );

  if (state.status === "playing-match") {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <MatchBoard
          sessionId={state.sessionId}
          items={state.items}
          slots={state.slots}
          timelineTitle={state.timelineTitle}
          accent={mode?.accent}
          renderResult={renderDailyResult}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      <TimelineBoard
        sessionId={state.sessionId}
        initialCards={state.cards}
        timelineTitle={state.timelineTitle}
        accent={mode?.accent}
        renderResult={renderDailyResult}
      />
    </div>
  );
}
