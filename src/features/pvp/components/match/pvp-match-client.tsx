"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGameMode, type GameModeDefinition } from "@/features/game-engine/domain/modes-registry";
import { TimelineBoard } from "@/features/game-engine/components/board/timeline-board";
import { MatchBoard } from "@/features/game-engine/components/board/match-board";
import { GuessBoard } from "@/features/game-engine/components/board/guess-board";
import { Button } from "@/components/ui/button";
import { startPvpGameSession, type StartPvpGameSessionResult } from "@/features/pvp/actions/start-pvp-game-session";
import { usePvpMatch } from "@/features/pvp/hooks/use-pvp-match";
import { useReportPvpResult } from "@/features/pvp/hooks/use-report-pvp-result";
import { Countdown } from "./countdown";
import { PvpCountdownTimer } from "./pvp-countdown-timer";
import { PlayerVsPlayerHeader } from "./player-vs-player-header";
import { PvpGameResultCard } from "./pvp-game-result-card";
import { FinalResultScreen } from "./final-result-screen";
import type { PvpMatchState } from "@/features/pvp/domain/types";

export interface PvpMatchClientProps {
  matchId: string;
  initialState: PvpMatchState;
}

type Stars = 1 | 2 | 3 | 4 | 5;

function ReportedResult({
  sessionId,
  gameIndex,
  matchState,
  onReported,
  points,
  stars,
  gaveUp,
}: {
  sessionId: string;
  gameIndex: number;
  matchState: PvpMatchState;
  onReported: (state: PvpMatchState) => void;
  points: number | null;
  stars: Stars | null;
  gaveUp?: boolean;
}) {
  // Solo se monta cuando el board correspondiente ya llamó a `renderResult` — es decir, cuando
  // finishSession/finishGuessSession (del propio modo, sin cambios) ya resolvió del todo.
  const { error } = useReportPvpResult(sessionId, onReported);
  return <PvpGameResultCard gameIndex={gameIndex} points={points} stars={stars} gaveUp={gaveUp} matchState={matchState} error={error} />;
}

function GameBoard({
  mode,
  data,
  gameIndex,
  matchState,
  onReported,
}: {
  mode: GameModeDefinition | undefined;
  data: StartPvpGameSessionResult;
  gameIndex: number;
  matchState: PvpMatchState;
  onReported: (state: PvpMatchState) => void;
}) {
  const timelineTitle = mode?.name ?? "";

  if (data.interaction === "match") {
    return (
      <MatchBoard
        sessionId={data.sessionId}
        items={data.items}
        slots={data.slots}
        timelineTitle={timelineTitle}
        accent={mode?.accent}
        matchVariant={mode?.matchVariant}
        renderResult={({ score }) => (
          <ReportedResult
            sessionId={data.sessionId}
            gameIndex={gameIndex}
            matchState={matchState}
            onReported={onReported}
            points={score.points}
            stars={score.stars}
          />
        )}
      />
    );
  }

  if (data.interaction === "guess") {
    return (
      <GuessBoard
        sessionId={data.sessionId}
        timelineTitle={timelineTitle}
        renderResult={({ score, gaveUp }) => (
          <ReportedResult
            sessionId={data.sessionId}
            gameIndex={gameIndex}
            matchState={matchState}
            onReported={onReported}
            points={score?.points ?? null}
            stars={score?.stars ?? null}
            gaveUp={gaveUp}
          />
        )}
      />
    );
  }

  return (
    <TimelineBoard
      sessionId={data.sessionId}
      initialCards={data.cards}
      timelineTitle={timelineTitle}
      accent={mode?.accent}
      cardVariant={mode?.cardVariant}
      boardLayout={mode?.boardLayout}
      renderResult={({ score }) => (
        <ReportedResult
          sessionId={data.sessionId}
          gameIndex={gameIndex}
          matchState={matchState}
          onReported={onReported}
          points={score.points}
          stars={score.stars}
        />
      )}
    />
  );
}

/**
 * Orquestador del duelo: monta EXACTAMENTE los mismos 3 boards que ya usan el juego individual y
 * el Daily Challenge (mismo patrón que `DailyChallengeClient`/`PlayTimelineClient`) — no
 * reimplementa ninguna regla ni animación de ningún modo, solo decide CUÁNDO arrancar cada juego
 * y qué hacer con el resultado ya calculado por el modo.
 */
export function PvpMatchClient({ matchId, initialState }: PvpMatchClientProps) {
  const { state, errorMessage, leave, applyState } = usePvpMatch(matchId, initialState);
  const [showCountdown, setShowCountdown] = useState(true);
  const [session, setSession] = useState<{ gameIndex: number; data: StartPvpGameSessionResult } | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const startingGameIndexRef = useRef<number | null>(null);

  const currentGame = state?.games.find((game) => game.gameIndex === state.currentGameIndex) ?? null;

  useEffect(() => {
    if (!state || state.status !== "in_progress" || !currentGame || currentGame.status !== "active") return;
    if (currentGame.myResult) return;
    if (session?.gameIndex === currentGame.gameIndex) return;
    if (startingGameIndexRef.current === currentGame.gameIndex) return;

    startingGameIndexRef.current = currentGame.gameIndex;
    startPvpGameSession(currentGame.modeId, currentGame.timelineId, currentGame.id)
      .then((data) => {
        setStartError(null);
        setSession({ gameIndex: currentGame.gameIndex, data });
      })
      .catch((error: unknown) => setStartError(error instanceof Error ? error.message : "No se pudo cargar el juego."))
      .finally(() => {
        startingGameIndexRef.current = null;
      });
  }, [state, currentGame, session]);

  const handleReported = useCallback(
    (next: PvpMatchState) => {
      applyState(next);
      setSession(null);
    },
    [applyState],
  );

  if (errorMessage) {
    return <p className="text-danger">{errorMessage}</p>;
  }
  if (!state) {
    return <p className="text-muted">Cargando partida…</p>;
  }
  if (state.status === "completed" || state.status === "abandoned" || state.status === "cancelled") {
    return <FinalResultScreen state={state} />;
  }
  if (showCountdown) {
    return <Countdown onComplete={() => setShowCountdown(false)} />;
  }

  const mode = currentGame ? getGameMode(currentGame.modeId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PlayerVsPlayerHeader state={state} />

      {currentGame && !currentGame.myResult && currentGame.status === "active" && currentGame.endsAt && (
        <div className="flex justify-center">
          <PvpCountdownTimer endsAt={currentGame.endsAt} />
        </div>
      )}

      {startError && <p className="text-sm text-danger">{startError}</p>}

      {currentGame?.myResult ? (
        <PvpGameResultCard
          gameIndex={currentGame.gameIndex}
          points={currentGame.myResult.points}
          stars={(currentGame.myResult.stars as Stars | null) ?? null}
          matchState={state}
          error={null}
        />
      ) : session && currentGame && session.gameIndex === currentGame.gameIndex ? (
        <GameBoard mode={mode} data={session.data} gameIndex={session.gameIndex} matchState={state} onReported={handleReported} />
      ) : (
        <p className="text-muted">Cargando siguiente juego…</p>
      )}

      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => void leave()}>
          Abandonar partida
        </Button>
      </div>
    </div>
  );
}
