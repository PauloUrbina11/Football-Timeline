import { describe, expect, it } from "vitest";
import { parseCompactEur, sanitizeGuessNumberInput } from "./guess-input";

describe("sanitizeGuessNumberInput", () => {
  it("acepta hasta 3 dígitos", () => {
    expect(sanitizeGuessNumberInput("2", "")).toBe("2");
    expect(sanitizeGuessNumberInput("22", "2")).toBe("22");
    expect(sanitizeGuessNumberInput("222", "22")).toBe("222");
  });

  it("rechaza un 4to dígito, quedándose con el valor anterior", () => {
    expect(sanitizeGuessNumberInput("2223", "222")).toBe("222");
  });

  it("acepta una coma decimal sin contarla como dígito", () => {
    expect(sanitizeGuessNumberInput("24,3", "24,")).toBe("24,3");
  });

  it("rechaza una segunda coma", () => {
    expect(sanitizeGuessNumberInput("2,4,3", "2,43")).toBe("2,43");
  });

  it("descarta letras y otros caracteres no numéricos", () => {
    expect(sanitizeGuessNumberInput("2a2M", "")).toBe("22");
  });
});

describe("parseCompactEur", () => {
  it("convierte un número entero en millones", () => {
    expect(parseCompactEur("222", "M")).toBe(222_000_000);
  });

  it("convierte un número entero en miles", () => {
    expect(parseCompactEur("235", "k")).toBe(235_000);
  });

  it("respeta un decimal (coma) en millones", () => {
    expect(parseCompactEur("24,3", "M")).toBe(24_300_000);
  });

  it("devuelve null para una entrada vacía", () => {
    expect(parseCompactEur("", "M")).toBeNull();
  });

  it("devuelve null para un valor negativo", () => {
    expect(parseCompactEur("-5", "M")).toBeNull();
  });
});
