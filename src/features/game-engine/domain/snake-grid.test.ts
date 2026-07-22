import { describe, expect, it } from "vitest";
import { getSnakeColumnCount, getSnakeLayout } from "./snake-grid";

describe("getSnakeColumnCount", () => {
  it("nunca devuelve menos de 2 columnas", () => {
    expect(getSnakeColumnCount(1)).toBeGreaterThanOrEqual(2);
    expect(getSnakeColumnCount(2)).toBeGreaterThanOrEqual(2);
  });

  it("se aproxima a una grilla cuadrada", () => {
    expect(getSnakeColumnCount(6)).toBe(3);
    expect(getSnakeColumnCount(10)).toBe(4);
  });
});

describe("getSnakeLayout", () => {
  it("serpentea: la fila 1 va en orden de columnas invertido respecto a la fila 0", () => {
    const layout = getSnakeLayout(6, 3);
    expect(layout.map((cell) => cell.col)).toEqual([0, 1, 2, 2, 1, 0]);
    expect(layout.map((cell) => cell.row)).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it("cada celda intermedia de una fila apunta hacia el sentido de lectura de esa fila", () => {
    const layout = getSnakeLayout(6, 3);
    expect(layout[0].direction).toBe("right");
    expect(layout[1].direction).toBe("right");
    expect(layout[2].direction).toBe("down");
    expect(layout[3].direction).toBe("left");
    expect(layout[4].direction).toBe("left");
    expect(layout[5].direction).toBe("end");
  });

  it("nunca hay dos celdas con la misma posición (row, col)", () => {
    const layout = getSnakeLayout(10, 4);
    const seen = new Set(layout.map((cell) => `${cell.row},${cell.col}`));
    expect(seen.size).toBe(layout.length);
  });
});
