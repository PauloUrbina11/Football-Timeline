import type { DifficultyId } from "./types";

export interface ScoringConfig {
  basePointsPerEvent: number;
  difficultyMultiplier: Record<DifficultyId, number>;
  attemptPenaltyRate: number;
  idealSecondsPerEvent: number;
  timePenaltyRate: number;
  timePenaltyCap: number;
  firstTryBonusRate: number;
  /** % de los puntos máximos posibles necesario para alcanzar 2, 3, 4 y 5 estrellas. */
  starThresholds: readonly [number, number, number, number];
}

export const scoringConfigV1: ScoringConfig = {
  basePointsPerEvent: 100,
  difficultyMultiplier: {
    easy: 1.0,
    medium: 1.15,
    hard: 1.3,
    expert: 1.5,
    // "single" (modo "guess") nunca pasa por esta fórmula — usa guess-scoring.ts / finish_guess_session
    // en su lugar — pero el tipo exige el valor para las 5 dificultades.
    single: 1.0,
  },
  attemptPenaltyRate: 0.15,
  idealSecondsPerEvent: 6,
  timePenaltyRate: 0.1,
  timePenaltyCap: 0.5,
  firstTryBonusRate: 0.2,
  starThresholds: [0.35, 0.55, 0.75, 0.9],
};

export interface ScoreInput {
  totalEvents: number;
  timeMs: number;
  attempts: number;
  firstTry: boolean;
  difficulty: DifficultyId;
}

export type Stars = 1 | 2 | 3 | 4 | 5;

export interface ScoreResult {
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

/** Función pura y determinista: mismo input + misma config → mismo resultado. Versionar `config` (no mutar) al ajustar pesos. */
export function calculateScore(input: ScoreInput, config: ScoringConfig = scoringConfigV1): ScoreResult {
  const { totalEvents, timeMs, attempts, firstTry, difficulty } = input;

  const maxBase = totalEvents * config.basePointsPerEvent;
  const difficultyMultiplier = config.difficultyMultiplier[difficulty];

  const attemptPenalty = Math.min(1, Math.max(0, attempts - 1) * config.attemptPenaltyRate);

  const idealMs = totalEvents * config.idealSecondsPerEvent * 1000;
  const timeRatio = idealMs > 0 ? Math.min(3, timeMs / idealMs) : 1;
  const timePenalty = Math.min(config.timePenaltyCap, Math.max(0, (timeRatio - 1) * config.timePenaltyRate));

  const raw = maxBase * difficultyMultiplier * (1 - attemptPenalty) * (1 - timePenalty);
  const bonus = firstTry ? maxBase * config.firstTryBonusRate : 0;
  const points = Math.round(Math.max(0, raw + bonus));

  const maxPossible = maxBase * difficultyMultiplier * (1 + config.firstTryBonusRate);
  const ratio = maxPossible > 0 ? points / maxPossible : 0;
  const stars = starsFromRatio(ratio, config.starThresholds);

  return { points, stars };
}
