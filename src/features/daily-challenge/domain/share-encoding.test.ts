import { describe, expect, it } from "vitest";
import { formatShareText } from "./share-encoding";

describe("formatShareText", () => {
  const base = {
    challengeDateISO: "2026-07-21",
    resultGrid: "🟩🟩⬜🟩🟩🟩",
    timeMs: 72_000,
    shareUrl: "https://footballtimeline.app/s/ab3f9k",
  };

  it("no revela el contenido real del timeline (solo grid, fecha, tiempo, estrellas y link)", () => {
    const text = formatShareText({ ...base, stars: 4 });
    expect(text).toContain("21/07/2026");
    expect(text).toContain(base.resultGrid);
    expect(text).toContain("1:12");
    expect(text).toContain("⭐⭐⭐⭐☆");
    expect(text).toContain(base.shareUrl);
    expect(text).not.toMatch(/Real Madrid|Messi|Ronaldo|Barcelona/i);
  });

  it("las 5 estrellas se muestran todas llenas", () => {
    expect(formatShareText({ ...base, stars: 5 })).toContain("⭐⭐⭐⭐⭐");
  });

  it("es determinista", () => {
    const a = formatShareText({ ...base, stars: 3 });
    const b = formatShareText({ ...base, stars: 3 });
    expect(a).toBe(b);
  });
});
