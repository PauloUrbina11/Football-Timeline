import { describe, expect, it } from "vitest";
import { calculateScore, scoringConfigV1 } from "./scoring";

describe("calculateScore", () => {
  it("otorga la puntuación máxima posible con 1 intento y tiempo ideal", () => {
    const idealMs = 4 * scoringConfigV1.idealSecondsPerEvent * 1000;
    const result = calculateScore({
      totalEvents: 4,
      timeMs: idealMs,
      attempts: 1,
      firstTry: true,
      difficulty: "easy",
    });
    expect(result.stars).toBe(5);
    expect(result.points).toBeGreaterThan(0);
  });

  it("penaliza puntos por cada intento extra", () => {
    const base = { totalEvents: 6, timeMs: 30_000, firstTry: false, difficulty: "medium" as const };
    const oneAttempt = calculateScore({ ...base, attempts: 1 });
    const threeAttempts = calculateScore({ ...base, attempts: 3 });
    expect(threeAttempts.points).toBeLessThan(oneAttempt.points);
  });

  it("penaliza puntos por exceso de tiempo, con un tope máximo", () => {
    const base = { totalEvents: 6, attempts: 1, firstTry: false, difficulty: "medium" as const };
    const fast = calculateScore({ ...base, timeMs: 10_000 });
    const slow = calculateScore({ ...base, timeMs: 10_000_000 });
    expect(slow.points).toBeLessThan(fast.points);
    expect(slow.points).toBeGreaterThanOrEqual(0);
  });

  it("otorga bonus por resolver a la primera intento", () => {
    const base = { totalEvents: 8, timeMs: 40_000, attempts: 1, difficulty: "hard" as const };
    const firstTry = calculateScore({ ...base, firstTry: true });
    const notFirstTry = calculateScore({ ...base, firstTry: false });
    expect(firstTry.points).toBeGreaterThan(notFirstTry.points);
  });

  it("aplica un multiplicador de dificultad creciente", () => {
    const base = { timeMs: 24_000, attempts: 1, firstTry: true };
    const easy = calculateScore({ ...base, totalEvents: 4, difficulty: "easy" });
    const expert = calculateScore({ ...base, totalEvents: 4, difficulty: "expert" });
    expect(expert.points).toBeGreaterThan(easy.points);
  });

  it("nunca devuelve puntos negativos, incluso en el peor de los casos", () => {
    const result = calculateScore({
      totalEvents: 10,
      timeMs: 999_999_999,
      attempts: 50,
      firstTry: false,
      difficulty: "expert",
    });
    expect(result.points).toBeGreaterThanOrEqual(0);
    expect(result.stars).toBeGreaterThanOrEqual(1);
  });

  it("es determinista: mismo input produce siempre el mismo resultado", () => {
    const input = { totalEvents: 6, timeMs: 45_000, attempts: 2, firstTry: false, difficulty: "medium" as const };
    expect(calculateScore(input)).toEqual(calculateScore(input));
  });

  it.each([
    ["easy", 4],
    ["medium", 6],
    ["hard", 8],
    ["expert", 10],
  ] as const)("calcula un resultado válido para dificultad %s con %i eventos", (difficulty, totalEvents) => {
    const result = calculateScore({ totalEvents, timeMs: 30_000, attempts: 1, firstTry: true, difficulty });
    expect(result.stars).toBeGreaterThanOrEqual(1);
    expect(result.stars).toBeLessThanOrEqual(5);
  });
});
