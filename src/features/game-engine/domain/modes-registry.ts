import type { GameModeId } from "./types";

export type ModeAccent = "primary" | "accent" | "blue" | "rose" | "violet" | "amber";

/**
 * "sort": ordenar una lista (mecánica original, TimelineBoard).
 * "match": arrastrar cada elemento a un casillero fijo que revela un dato real (ej. el año) —
 * MatchBoard. Ver supabase/migrations/0011_match_mode_rpcs.sql.
 */
export type ModeInteraction = "sort" | "match";

/**
 * Solo aplica cuando `interaction === "match"`, decide qué lado revela el dato real:
 * "year-slots" (Transfer): los casilleros revelan el año; los elementos arrastrables ocultan la
 * identidad (camiseta genérica). "name-slots" (Ballon d'Or): al revés — los elementos ya muestran
 * el año (un balón), y se arrastran hacia el casillero con el nombre/avatar del jugador. Ver
 * supabase/migrations/0012_ballon_dor_reverse_match_rpcs.sql.
 */
export type MatchVariant = "year-slots" | "name-slots";

/**
 * "text": título de la tarjeta (por defecto). "flags": bandera vs bandera, sin texto. "avatar":
 * iniciales genéricas + nombre (para personas, ej. entrenadores) — ver EventCard.
 */
export type CardVariant = "text" | "flags" | "avatar";

/**
 * "vertical" (lista, por defecto), "horizontal" (línea de tiempo, ver TimelineBoard) o "path"
 * (grilla en forma de camino/serpiente, ver snake-grid.ts — Achievement Timeline).
 */
export type BoardLayout = "vertical" | "horizontal" | "path";

export interface GameModeDefinition {
  id: GameModeId;
  name: string;
  shortDescription: string;
  icon: string;
  /** Color de acento del tablero para este modo (ver globals.css) — les da identidad visual propia. */
  accent: ModeAccent;
  interaction: ModeInteraction;
  cardVariant: CardVariant;
  boardLayout: BoardLayout;
  matchVariant?: MatchVariant;
}

/**
 * Espejo, en el cliente, de la tabla `game_modes` (ver supabase/migrations/0003_seed_lookup_data.sql).
 * Añadir un modo nuevo = insertar la fila en la base de datos + añadir su entrada aquí. No requiere migración de esquema.
 *
 * Deliberadamente SIN ningún ejemplo de orden cronológico aquí: un ejemplo real coincidiría con
 * un timeline real ya sembrado y revelaría su respuesta antes de jugar (pasó con Tournament
 * Timeline / Mundial de Catar 2022 — ver docs/architecture.md).
 */
export const GAME_MODES: readonly GameModeDefinition[] = [
  {
    id: "career",
    name: "Career Timeline",
    shortDescription: "Ordena los clubes por los que pasó un jugador.",
    icon: "🎽",
    accent: "primary",
    interaction: "sort",
    cardVariant: "text",
    boardLayout: "vertical",
  },
  {
    id: "achievement",
    name: "Achievement Timeline",
    shortDescription: "Ordena los premios y logros de un jugador en un tablero tipo laberinto.",
    icon: "🏆",
    accent: "violet",
    interaction: "sort",
    cardVariant: "text",
    boardLayout: "path",
  },
  {
    id: "club_coach",
    name: "Club Timeline",
    shortDescription: "Ordena a los entrenadores en una línea de tiempo.",
    icon: "📋",
    accent: "blue",
    interaction: "sort",
    cardVariant: "avatar",
    boardLayout: "horizontal",
  },
  {
    id: "tournament",
    name: "Tournament Timeline",
    shortDescription: "Ordena los acontecimientos clave de un torneo.",
    icon: "🌍",
    accent: "rose",
    interaction: "sort",
    cardVariant: "flags",
    boardLayout: "vertical",
  },
  {
    id: "transfer",
    name: "Transfer Timeline",
    shortDescription: "Arrastra cada camiseta al año en que fue fichado.",
    icon: "🔄",
    accent: "amber",
    interaction: "match",
    cardVariant: "text",
    boardLayout: "vertical",
    matchVariant: "year-slots",
  },
  {
    id: "ballon_dor",
    name: "Ballon d'Or Timeline",
    shortDescription: "Arrastra cada balón de oro hacia el jugador que lo ganó.",
    icon: "⭐",
    accent: "accent",
    interaction: "match",
    cardVariant: "text",
    boardLayout: "vertical",
    matchVariant: "name-slots",
  },
] as const;

/** Acepta `string` (no solo `GameModeId`) porque normalmente se llama con un parámetro de ruta sin validar todavía. */
export function getGameMode(id: string): GameModeDefinition | undefined {
  return GAME_MODES.find((mode) => mode.id === id);
}
