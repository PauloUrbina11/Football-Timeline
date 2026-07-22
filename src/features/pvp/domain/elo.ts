/**
 * Fórmula ELO estándar — espejo exacto de `calculate_elo_delta` en
 * supabase/migrations/0020_pvp_rating_and_stats.sql (esa es la versión autoritativa que de verdad
 * se persiste; esta es la especificación ejecutable vía sus tests, mismo patrón que
 * scoring.ts ↔ calculate_score_v1).
 */

/** 1 = A ganó, 0.5 = empate, 0 = A perdió. */
export type EloOutcome = 1 | 0.5 | 0;

export interface EloChangeResult {
  deltaA: number;
  deltaB: number;
}

/**
 * `k` es el "learning rate" del algoritmo, no una cantidad fija de puntos: el cambio real
 * depende de la diferencia de Rating entre ambos jugadores (ver `expectedA`). Un abandono se
 * trata igual que una derrota normal (outcomeA=0 para quien abandona).
 */
export function calculateEloChange(ratingA: number, ratingB: number, outcomeA: EloOutcome, k = 32): EloChangeResult {
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const deltaA = Math.round(k * (outcomeA - expectedA));
  // Normaliza -0 a 0 (Math.round(0 * -1) puede dar -0, que falla comparaciones estrictas Object.is).
  return { deltaA, deltaB: deltaA === 0 ? 0 : -deltaA };
}
