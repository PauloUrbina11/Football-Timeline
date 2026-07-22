import { describe, expect, it } from "vitest";
import { calculateGuessScore } from "./guess-scoring";

describe("calculateGuessScore", () => {
  it("da la puntuación máxima posible con 1 intento y tiempo ideal", () => {
    const { points, stars } = calculateGuessScore({ attempts: 1, timeMs: 45_000, firstTry: true });
    expect(points).toBe(900); // 600 * (1 + 0.5) bonus de primer intento, sin penalizaciones
    expect(stars).toBe(5);
  });

  it("penaliza más puntos cuantos más intentos hicieron falta", () => {
    const few = calculateGuessScore({ attempts: 2, timeMs: 45_000, firstTry: false });
    const many = calculateGuessScore({ attempts: 8, timeMs: 45_000, firstTry: false });
    expect(few.points).toBeGreaterThan(many.points);
  });

  it("nunca da puntos negativos incluso con muchísimos intentos y mucho tiempo", () => {
    const { points } = calculateGuessScore({ attempts: 50, timeMs: 600_000, firstTry: false });
    expect(points).toBeGreaterThanOrEqual(0);
  });

  it("penaliza el exceso de tiempo pero con un tope (nunca resta más del cap configurado)", () => {
    const fast = calculateGuessScore({ attempts: 3, timeMs: 10_000, firstTry: false });
    const slow = calculateGuessScore({ attempts: 3, timeMs: 10_000_000, firstTry: false });
    expect(slow.points).toBeLessThan(fast.points);
    expect(slow.points).toBeGreaterThan(0);
  });
});
