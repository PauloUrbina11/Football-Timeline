export interface GuessScoringConfig {
  basePoints: number;
  attemptPenaltyRate: number;
  idealSeconds: number;
  timePenaltyRate: number;
  timePenaltyCap: number;
  firstTryBonusRate: number;
  starThresholds: readonly [number, number, number, number];
}

/**
 * Especificación ejecutable de `finish_guess_session` en
 * supabase/migrations/0013_guess_mode.sql — debe mantenerse en sincronía manualmente
 * (mismo patrón que scoring.ts/calculate_score_v1).
 */
export const guessScoringConfigV1: GuessScoringConfig = {
  basePoints: 600,
  attemptPenaltyRate: 0.12,
  idealSeconds: 45,
  timePenaltyRate: 0.08,
  timePenaltyCap: 0.4,
  firstTryBonusRate: 0.5,
  starThresholds: [0.35, 0.55, 0.75, 0.9],
};

export interface GuessScoreInput {
  attempts: number;
  timeMs: number;
  firstTry: boolean;
}

export type Stars = 1 | 2 | 3 | 4 | 5;

export interface GuessScoreResult {
  points: number;
  stars: Stars;
}

function starsFromRatio(ratio: number, thresholds: readonly [number, number, number, number]): Stars {
  const [t1, t2, t3, t4] = thresholds;
  if (ratio >= t4) return 5;
  if (ratio >= t3) return 4;
  if (ratio >= t2) return 3;
  if (ratio >= t1) return 2;
  return 1;
}

/**
 * A diferencia de `calculateScore` (scoring.ts), no hay `totalEvents`: el reto es un único valor
 * numérico, así que la base es fija y la penalización depende directamente de cuántos intentos
 * de "más alto/más bajo" hicieron falta para acertar.
 */
export function calculateGuessScore(input: GuessScoreInput, config: GuessScoringConfig = guessScoringConfigV1): GuessScoreResult {
  const { attempts, timeMs, firstTry } = input;

  const attemptPenalty = Math.min(1, Math.max(0, attempts - 1) * config.attemptPenaltyRate);

  const idealMs = config.idealSeconds * 1000;
  const timeRatio = Math.min(3, timeMs / idealMs);
  const timePenalty = Math.min(config.timePenaltyCap, Math.max(0, (timeRatio - 1) * config.timePenaltyRate));

  const raw = config.basePoints * (1 - attemptPenalty) * (1 - timePenalty);
  const bonus = firstTry ? config.basePoints * config.firstTryBonusRate : 0;
  const points = Math.round(Math.max(0, raw + bonus));

  const maxPossible = config.basePoints * (1 + config.firstTryBonusRate);
  const ratio = maxPossible > 0 ? points / maxPossible : 0;
  const stars = starsFromRatio(ratio, config.starThresholds);

  return { points, stars };
}
