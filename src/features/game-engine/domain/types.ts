export type GameModeId =
  | "career"
  | "achievement"
  | "club_coach"
  | "tournament"
  | "transfer"
  | "ballon_dor";

export type DifficultyId = "easy" | "medium" | "hard" | "expert";

export interface DifficultyDefinition {
  id: DifficultyId;
  label: string;
  eventCount: number;
}

export const DIFFICULTIES: readonly DifficultyDefinition[] = [
  { id: "easy", label: "Fácil", eventCount: 4 },
  { id: "medium", label: "Media", eventCount: 6 },
  { id: "hard", label: "Difícil", eventCount: 8 },
  { id: "expert", label: "Experto", eventCount: 10 },
] as const;

export function getDifficulty(id: DifficultyId): DifficultyDefinition {
  const difficulty = DIFFICULTIES.find((d) => d.id === id);
  if (!difficulty) {
    throw new Error(`Dificultad desconocida: ${id}`);
  }
  return difficulty;
}

/**
 * Tarjeta de evento tal como la recibe el cliente: nunca incluye el orden correcto ni
 * `description` — un texto narrativo puede filtrar pistas de orden relativo entre tarjetas
 * (ver docs/architecture.md) aunque no mencione fechas.
 */
export interface EventCardData {
  id: string;
  title: string;
  displayDate: string | null;
  imageUrl: string | null;
  metadata: Record<string, unknown>;
}

/** Elemento arrastrable de un modo "match" (ver ModeInteraction en modes-registry.ts). */
export interface MatchCardData {
  id: string;
  title: string;
  metadata: Record<string, unknown>;
}

/** Casillero fijo de un modo "match": revela un dato real (ej. el año) a propósito. */
export interface SlotLabel {
  slotIndex: number;
  label: string;
}
