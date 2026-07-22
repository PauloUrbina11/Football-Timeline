import { describe, expect, it } from "vitest";
import { getPaletteColor } from "./palette-colors";

describe("getPaletteColor", () => {
  it("es determinista: la misma etiqueta siempre da el mismo color", () => {
    expect(getPaletteColor("Juventus")).toEqual(getPaletteColor("Juventus"));
  });

  it("etiquetas distintas normalmente dan colores distintos", () => {
    const labels = ["Juventus", "Inter de Milán", "FC Barcelona", "AC Milan", "Paris Saint-Germain", "Manchester United"];
    const colors = new Set(labels.map((label) => getPaletteColor(label).main));
    expect(colors.size).toBeGreaterThan(1);
  });
});
