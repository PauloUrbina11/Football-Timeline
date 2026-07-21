import type { GameModeId } from "./types";

export type ModeAccent = "primary" | "accent" | "blue" | "rose" | "violet" | "amber";

export interface GameModeDefinition {
  id: GameModeId;
  name: string;
  shortDescription: string;
  icon: string;
  /** Color de acento del tablero para este modo (ver globals.css) — les da identidad visual propia. */
  accent: ModeAccent;
}

/**
 * Espejo, en el cliente, de la tabla `game_modes` (ver supabase/migrations/0003_seed_lookup_data.sql).
 * Añadir un modo nuevo = insertar la fila en la base de datos + añadir su entrada aquí. No requiere migración de esquema.
 *
 * Deliberadamente SIN ningún ejemplo de orden cronológico aquí: un ejemplo real coincidiría con
 * un timeline real ya sembrado y revelaría su respuesta antes de jugar (pasó con Tournament
 * Timeline / Mundial de Catar 2022 — ver docs/architecture.md).
 *
 * Se probó (y se revirtió) un layout horizontal para Tournament Timeline: se rompía de forma
 * consistente en contexto táctil combinado con dnd-kit (ver docs/architecture.md). Queda pendiente
 * como experimento futuro dedicado, no como parte de este cambio.
 */
export const GAME_MODES: readonly GameModeDefinition[] = [
  {
    id: "career",
    name: "Career Timeline",
    shortDescription: "Ordena los clubes por los que pasó un jugador.",
    icon: "🎽",
    accent: "primary",
  },
  {
    id: "achievement",
    name: "Achievement Timeline",
    shortDescription: "Ordena los logros más importantes de la carrera de un jugador.",
    icon: "🏆",
    accent: "violet",
  },
  {
    id: "club_coach",
    name: "Club Timeline",
    shortDescription: "Ordena a los entrenadores que dirigieron a un club.",
    icon: "📋",
    accent: "blue",
  },
  {
    id: "tournament",
    name: "Tournament Timeline",
    shortDescription: "Ordena los acontecimientos clave de un torneo.",
    icon: "🌍",
    accent: "rose",
  },
  {
    id: "transfer",
    name: "Transfer Timeline",
    shortDescription: "Ordena los fichajes de un jugador a lo largo de su carrera.",
    icon: "🔄",
    accent: "amber",
  },
  {
    id: "ballon_dor",
    name: "Ballon d'Or Timeline",
    shortDescription: "Ordena a los ganadores del Balón de Oro.",
    icon: "⭐",
    accent: "accent",
  },
] as const;

/** Acepta `string` (no solo `GameModeId`) porque normalmente se llama con un parámetro de ruta sin validar todavía. */
export function getGameMode(id: string): GameModeDefinition | undefined {
  return GAME_MODES.find((mode) => mode.id === id);
}
