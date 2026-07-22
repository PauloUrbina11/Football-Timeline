"use client";

import { useCallback, useState } from "react";
import { submitAttempt } from "@/features/game-engine/actions/submit-attempt";
import { finishSession } from "@/features/game-engine/actions/finish-session";
import {
  createInitialMatchState,
  isMatchComplete,
  placeItem,
  removeFromSlot,
  shufflePool,
  toSubmittedOrder,
  type MatchState,
} from "@/features/game-engine/domain/match-placement";
import type { CardCheckState, FinalScore, GameSessionStatus } from "./use-game-session";

/** Estado y acciones de una partida "emparejar": pool de elementos sueltos + casilleros fijos. */
export function useMatchSession(sessionId: string, itemIds: string[], slotCount: number) {
  const [state, setState] = useState<MatchState>(() => {
    const initial = createInitialMatchState(itemIds, slotCount);
    return { ...initial, pool: shufflePool(initial.pool) };
  });
  const [slotStates, setSlotStates] = useState<CardCheckState[]>(() => Array.from({ length: slotCount }, () => "idle"));
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<GameSessionStatus>("playing");
  const [finalScore, setFinalScore] = useState<FinalScore | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetSlotStates = useCallback(() => {
    setSlotStates((current) => current.map(() => "idle"));
  }, []);

  const place = useCallback(
    (eventId: string, slotIndex: number) => {
      setState((current) => placeItem(current, eventId, slotIndex));
      resetSlotStates();
    },
    [resetSlotStates],
  );

  const unplace = useCallback(
    (slotIndex: number) => {
      setState((current) => removeFromSlot(current, slotIndex));
      resetSlotStates();
    },
    [resetSlotStates],
  );

  const reset = useCallback(() => {
    setState((current) => {
      const placedIds = current.placements.filter((id): id is string => id !== null);
      return {
        pool: shufflePool([...current.pool, ...placedIds]),
        placements: Array.from({ length: slotCount }, () => null),
      };
    });
    resetSlotStates();
  }, [slotCount, resetSlotStates]);

  const checkOrder = useCallback(async () => {
    if (!isMatchComplete(state)) {
      setErrorMessage("Coloca todos los elementos en un casillero antes de comprobar.");
      return;
    }

    setStatus("checking");
    setErrorMessage(null);
    try {
      const submittedOrder = toSubmittedOrder(state);
      const result = await submitAttempt(sessionId, submittedOrder);
      setAttempts((count) => count + 1);
      setSlotStates(result.correctPositions.map((isCorrect) => (isCorrect ? "correct" : "incorrect")));

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
  }, [sessionId, state]);

  return {
    pool: state.pool,
    placements: state.placements,
    slotStates,
    attempts,
    status,
    finalScore,
    errorMessage,
    isComplete: isMatchComplete(state),
    place,
    unplace,
    reset,
    checkOrder,
  };
}
