"use client";

import { useCallback, useState } from "react";
import { submitAttempt } from "@/features/game-engine/actions/submit-attempt";
import { finishSession } from "@/features/game-engine/actions/finish-session";
import type { EventCardData } from "@/features/game-engine/domain/types";
import type { Stars } from "@/features/game-engine/domain/scoring";

export type CardCheckState = "idle" | "correct" | "incorrect";
export type GameSessionStatus = "playing" | "checking" | "finished";

export interface FinalScore {
  points: number;
  stars: Stars;
}

/** Estado y acciones de una partida en curso: orden de tarjetas, intentos, y comprobación server-side. */
export function useGameSession(sessionId: string, initialCards: EventCardData[]) {
  const [cards, setCards] = useState(initialCards);
  const [cardStates, setCardStates] = useState<CardCheckState[]>(() => initialCards.map(() => "idle"));
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<GameSessionStatus>("playing");
  const [finalScore, setFinalScore] = useState<FinalScore | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetCardStates = useCallback(() => {
    setCardStates((current) => current.map(() => "idle"));
  }, []);

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setCards((current) => {
        const next = [...current];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
      resetCardStates();
    },
    [resetCardStates],
  );

  const shuffle = useCallback(() => {
    setCards((current) => {
      const next = [...current];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
    resetCardStates();
  }, [resetCardStates]);

  const checkOrder = useCallback(async () => {
    setStatus("checking");
    setErrorMessage(null);
    try {
      const result = await submitAttempt(
        sessionId,
        cards.map((card) => card.id),
      );
      setAttempts((count) => count + 1);
      setCardStates(result.correctPositions.map((isCorrect) => (isCorrect ? "correct" : "incorrect")));

      if (result.isFullyCorrect) {
        const score = await finishSession(sessionId);
        setFinalScore(score);
        setStatus("finished");
      } else {
        setStatus("playing");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Ocurrió un error inesperado.");
      setStatus("playing");
    }
  }, [sessionId, cards]);

  return { cards, cardStates, attempts, status, finalScore, errorMessage, reorder, shuffle, checkOrder };
}
