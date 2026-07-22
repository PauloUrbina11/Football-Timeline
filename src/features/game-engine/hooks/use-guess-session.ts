"use client";

import { useCallback, useState } from "react";
import { submitGuess } from "@/features/game-engine/actions/submit-guess";
import { finishGuessSession } from "@/features/game-engine/actions/finish-guess-session";
import type { GuessResult } from "@/features/game-engine/domain/types";
import type { Stars } from "@/features/game-engine/domain/guess-scoring";

export type GuessSessionStatus = "playing" | "checking" | "finished" | "gave_up";

export interface GuessHistoryEntry {
  attemptNumber: number;
  guessValueEur: number;
  result: GuessResult;
}

export interface GuessFinalScore {
  points: number;
  stars: Stars;
}

const MAX_ATTEMPTS = 10;

/** Estado y acciones de una partida "guess": historial de intentos + resultado final. */
export function useGuessSession(sessionId: string) {
  const [history, setHistory] = useState<GuessHistoryEntry[]>([]);
  const [status, setStatus] = useState<GuessSessionStatus>("playing");
  const [finalScore, setFinalScore] = useState<GuessFinalScore | null>(null);
  const [actualValueEur, setActualValueEur] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const guess = useCallback(
    async (value: number) => {
      setStatus("checking");
      setErrorMessage(null);
      try {
        const result = await submitGuess(sessionId, value);
        setHistory((current) => [...current, { attemptNumber: result.attemptNumber, guessValueEur: value, result: result.result }]);

        if (result.isCorrect) {
          const score = await finishGuessSession(sessionId, false);
          setFinalScore({ points: score.points, stars: score.stars });
          setActualValueEur(score.actualValueEur);
          setStatus("finished");
          return;
        }

        if (result.attemptNumber >= MAX_ATTEMPTS) {
          const score = await finishGuessSession(sessionId, true);
          setActualValueEur(score.actualValueEur);
          setStatus("gave_up");
          return;
        }

        setStatus("playing");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Ocurrió un error inesperado.");
        setStatus("playing");
      }
    },
    [sessionId],
  );

  const giveUp = useCallback(async () => {
    setStatus("checking");
    setErrorMessage(null);
    try {
      const score = await finishGuessSession(sessionId, true);
      setActualValueEur(score.actualValueEur);
      setStatus("gave_up");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Ocurrió un error inesperado.");
      setStatus("playing");
    }
  }, [sessionId]);

  return {
    history,
    attempts: history.length,
    maxAttempts: MAX_ATTEMPTS,
    status,
    finalScore,
    actualValueEur,
    errorMessage,
    guess,
    giveUp,
  };
}
