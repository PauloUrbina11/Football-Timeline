import type { GameModeId } from "./types";

export type ModeAccent = "primary" | "accent" | "blue" | "rose" | "violet" | "amber";

/**
 * "sort": ordenar una lista (mecánica original, TimelineBoard).
 * "match": arrastrar cada elemento a un casillero fijo que revela un dato real (ej. el año) —
 * MatchBoard. Ver supabase/migrations/0011_match_mode_rpcs.sql.
 */
export type ModeInteraction = "sort" | "match";

export interface GameModeDefinition {
  id: GameModeId;
  name: string;
  shortDescription: string;
  icon: string;
  /** Color de acento del tablero para este modo (ver globals.css) — les da identidad visual propia. */
  accent: ModeAccent;
  interaction: ModeInteraction;
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
    interaction: "sort",
  },
  {
    id: "achievement",
    name: "Achievement Timeline",
    shortDescription: "Ordena los logros más importantes de la carrera de un jugador.",
    icon: "🏆",
    accent: "violet",
    interaction: "sort",
  },
  {
    id: "club_coach",
    name: "Club Timeline",
    shortDescription: "Ordena a los entrenadores que dirigieron a un club.",
    icon: "📋",
    accent: "blue",
    interaction: "sort",
  },
  {
    id: "tournament",
    name: "Tournament Timeline",
    shortDescription: "Ordena los acontecimientos clave de un torneo.",
    icon: "🌍",
    accent: "rose",
    interaction: "sort",
  },
  {
    id: "transfer",
    name: "Transfer Timeline",
    shortDescription: "Arrastra cada camiseta al año en que fue fichado.",
    icon: "🔄",
    accent: "amber",
    interaction: "match",
  },
  {
    id: "ballon_dor",
    name: "Ballon d'Or Timeline",
    shortDescription: "Ordena a los ganadores del Balón de Oro.",
    icon: "⭐",
    accent: "accent",
    interaction: "sort",
  },
] as const;

/** Acepta `string` (no solo `GameModeId`) porque normalmente se llama con un parámetro de ruta sin validar todavía. */
export function getGameMode(id: string): GameModeDefinition | undefined {
  return GAME_MODES.find((mode) => mode.id === id);
}
