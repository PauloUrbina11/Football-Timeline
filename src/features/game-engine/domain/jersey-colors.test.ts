import { describe, expect, it } from "vitest";
import { getJerseyColors } from "./jersey-colors";

describe("getJerseyColors", () => {
  it("es determinista: la misma etiqueta siempre da el mismo color", () => {
    expect(getJerseyColors("Juventus")).toEqual(getJerseyColors("Juventus"));
  });

  it("etiquetas distintas normalmente dan colores distintos", () => {
    const clubs = ["Juventus", "Inter de Milán", "FC Barcelona", "AC Milan", "Paris Saint-Germain", "Manchester United"];
    const colors = new Set(clubs.map((club) => getJerseyColors(club).main));
    expect(colors.size).toBeGreaterThan(1);
  });
});
