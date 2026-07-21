import { describe, expect, it } from "vitest";
import { selectDailyTimelineIndex, todayChallengeDateISO } from "./daily-selector";

describe("selectDailyTimelineIndex", () => {
  it("es determinista: la misma fecha siempre da el mismo índice", () => {
    const a = selectDailyTimelineIndex("2026-07-21", 6);
    const b = selectDailyTimelineIndex("2026-07-21", 6);
    expect(a).toBe(b);
  });

  it("devuelve un índice siempre dentro de rango [0, count)", () => {
    for (let day = 1; day <= 31; day++) {
      const date = `2026-01-${day.toString().padStart(2, "0")}`;
      const index = selectDailyTimelineIndex(date, 6);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(6);
    }
  });

  it("rota: fechas consecutivas no dan siempre el mismo índice", () => {
    const indexes = new Set<number>();
    for (let day = 1; day <= 10; day++) {
      indexes.add(selectDailyTimelineIndex(`2026-02-${day.toString().padStart(2, "0")}`, 6));
    }
    expect(indexes.size).toBeGreaterThan(1);
  });

  it("lanza un error si no hay timelines elegibles", () => {
    expect(() => selectDailyTimelineIndex("2026-07-21", 0)).toThrow();
  });

  it("funciona con un solo timeline elegible (índice siempre 0)", () => {
    expect(selectDailyTimelineIndex("2026-07-21", 1)).toBe(0);
    expect(selectDailyTimelineIndex("2026-07-22", 1)).toBe(0);
  });
});

describe("todayChallengeDateISO", () => {
  it("formatea la fecha en UTC como YYYY-MM-DD", () => {
    const fixedDate = new Date("2026-07-21T23:30:00Z");
    expect(todayChallengeDateISO(fixedDate)).toBe("2026-07-21");
  });
});
