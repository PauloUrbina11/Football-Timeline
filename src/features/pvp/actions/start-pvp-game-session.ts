"use server";

import { startSession } from "@/features/game-engine/actions/start-session";
import { startMatchSession } from "@/features/game-engine/actions/start-match-session";
import { startGuessSession } from "@/features/game-engine/actions/start-guess-session";
import { getGameMode } from "@/features/game-engine/domain/modes-registry";
import type { EventCardData, MatchCardData, SlotLabel } from "@/features/game-engine/domain/types";

export type StartPvpGameSessionResult =
  | { interaction: "sort"; sessionId: string; cards: EventCardData[] }
  | { interaction: "match"; sessionId: string; items: MatchCardData[]; slots: SlotLabel[] }
  | { interaction: "guess"; sessionId: string };

/**
 * Arranca la sesión de juego de UN jugador para UN juego del match — exactamente las mismas 3
 * server actions que ya usan el juego individual y el Daily Challenge (ver
 * DailyChallengeClient), seleccionadas por `getGameMode(modeId).interaction` (mismo registro de
 * siempre). El PvP no tiene su propio "modo": solo decide CUÁNDO llamar a esto y a qué
 * `pvpMatchGameId` enlazar la sesión resultante.
 */
export async function startPvpGameSession(modeId: string, timelineId: string, pvpMatchGameId: string): Promise<StartPvpGameSessionResult> {
  const mode = getGameMode(modeId);

  if (mode?.interaction === "match") {
    const { sessionId, items, slots } = await startMatchSession(timelineId, undefined, mode.matchVariant, pvpMatchGameId);
    return { interaction: "match", sessionId, items, slots };
  }

  if (mode?.interaction === "guess") {
    const { sessionId } = await startGuessSession(timelineId, undefined, pvpMatchGameId);
    return { interaction: "guess", sessionId };
  }

  const { sessionId, cards } = await startSession(timelineId, undefined, pvpMatchGameId);
  return { interaction: "sort", sessionId, cards };
}
