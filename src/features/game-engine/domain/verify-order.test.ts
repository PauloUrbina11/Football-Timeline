import { describe, expect, it } from "vitest";
import { verifyOrder } from "./verify-order";

describe("verifyOrder", () => {
  const correctOrder = ["a", "b", "c", "d"];

  it("marca como correcto un orden idéntico", () => {
    const result = verifyOrder(["a", "b", "c", "d"], correctOrder);
    expect(result.isFullyCorrect).toBe(true);
    expect(result.correctCount).toBe(4);
    expect(result.correctPositions).toEqual([true, true, true, true]);
  });

  it("solo marca como incorrectas las posiciones que realmente fallan", () => {
    const result = verifyOrder(["a", "c", "b", "d"], correctOrder);
    expect(result.isFullyCorrect).toBe(false);
    expect(result.correctCount).toBe(2);
    expect(result.correctPositions).toEqual([true, false, false, true]);
  });

  it("no revela el orden correcto en el resultado", () => {
    const result = verifyOrder(["d", "c", "b", "a"], correctOrder);
    expect(result).not.toHaveProperty("correctOrder");
    expect(JSON.stringify(result)).not.toContain(correctOrder.join(""));
  });

  it("lanza un error si las longitudes no coinciden", () => {
    expect(() => verifyOrder(["a", "b"], correctOrder)).toThrow();
  });
});
