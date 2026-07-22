import { describe, expect, it } from "vitest";
import { calculateEloChange } from "./elo";

describe("calculateEloChange", () => {
  it("con Rating igual y victoria de A, A sube y B baja lo mismo", () => {
    const { deltaA, deltaB } = calculateEloChange(1000, 1000, 1);
    expect(deltaA).toBeGreaterThan(0);
    expect(deltaB).toBe(-deltaA);
  });

  it("con empate y Rating igual, el cambio neto es cero", () => {
    const { deltaA, deltaB } = calculateEloChange(1000, 1000, 0.5);
    expect(deltaA).toBe(0);
    expect(deltaB).toBe(0);
  });

  it("un jugador con menor Rating gana más puntos al vencer a uno con mayor Rating", () => {
    const underdogWins = calculateEloChange(1450, 1500, 1);
    const favoriteWins = calculateEloChange(1500, 1450, 1);
    expect(underdogWins.deltaA).toBeGreaterThan(favoriteWins.deltaA);
  });

  it("perder contra un rival de menor Rating penaliza más que perder contra uno de mayor Rating", () => {
    const favoriteLoses = calculateEloChange(1500, 1450, 0);
    const underdogLoses = calculateEloChange(1450, 1500, 0);
    expect(favoriteLoses.deltaA).toBeLessThan(underdogLoses.deltaA);
  });

  it("los deltas siempre son simétricos (suman cero)", () => {
    const { deltaA, deltaB } = calculateEloChange(1620, 980, 0);
    expect(deltaA + deltaB).toBe(0);
  });

  it("es determinista: mismo input produce siempre el mismo resultado", () => {
    const input = [1234, 1180, 1] as const;
    expect(calculateEloChange(...input)).toEqual(calculateEloChange(...input));
  });

  it("acepta un k configurable (no una cantidad fija de puntos)", () => {
    const lowK = calculateEloChange(1000, 1000, 1, 16);
    const highK = calculateEloChange(1000, 1000, 1, 64);
    expect(highK.deltaA).toBeGreaterThan(lowK.deltaA);
  });

  it("un abandono se trata como una derrota normal (outcome 0)", () => {
    const normalLoss = calculateEloChange(1000, 1000, 0);
    const abandonLoss = calculateEloChange(1000, 1000, 0);
    expect(abandonLoss).toEqual(normalLoss);
  });
});
