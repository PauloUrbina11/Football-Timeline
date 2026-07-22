/**
 * Rangos visuales basados en el Rating — únicamente presentación (ver plan de arquitectura del
 * módulo PvP): la clasificación real siempre depende del número de Rating, nunca del rango.
 */
export interface RatingRank {
  id: string;
  label: string;
  icon: string;
  min: number;
  max: number | null;
}

export const RATING_RANKS: readonly RatingRank[] = [
  { id: "bronze", label: "Bronce", icon: "🥉", min: 0, max: 999 },
  { id: "silver", label: "Plata", icon: "🥈", min: 1000, max: 1199 },
  { id: "gold", label: "Oro", icon: "🥇", min: 1200, max: 1399 },
  { id: "platinum", label: "Platino", icon: "💠", min: 1400, max: 1599 },
  { id: "diamond", label: "Diamante", icon: "💎", min: 1600, max: 1799 },
  { id: "master", label: "Maestro", icon: "👑", min: 1800, max: 1999 },
  { id: "legend", label: "Leyenda", icon: "🔥", min: 2000, max: null },
] as const;

export function getRankForRating(rating: number): RatingRank {
  return RATING_RANKS.find((rank) => rating >= rank.min && (rank.max === null || rating <= rank.max)) ?? RATING_RANKS[0];
}
