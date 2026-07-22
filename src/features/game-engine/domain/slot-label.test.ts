import { describe, expect, it } from "vitest";
import { stripSlotOrdinalSuffix } from "./slot-label";

describe("stripSlotOrdinalSuffix", () => {
  it("quita el sufijo ordinal cuando está presente", () => {
    expect(stripSlotOrdinalSuffix("Lionel Messi (5)")).toBe("Lionel Messi");
  });

  it("deja el nombre intacto cuando no hay sufijo", () => {
    expect(stripSlotOrdinalSuffix("Karim Benzema")).toBe("Karim Benzema");
  });

  it("no confunde un paréntesis que no está al final", () => {
    expect(stripSlotOrdinalSuffix("Jean-Pierre Papin")).toBe("Jean-Pierre Papin");
  });
});
