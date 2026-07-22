/**
 * Ubica N tarjetas en una grilla en forma de camino/serpiente (tipo tablero de juego de mesa):
 * la fila 0 se lee de izquierda a derecha, la fila 1 de derecha a izquierda, y así alternando —
 * así el elemento `index` y el elemento `index + 1` son siempre celdas vecinas en pantalla
 * (horizontal dentro de la fila, vertical al saltar de una fila a la siguiente).
 */
export interface SnakeCell {
  row: number;
  col: number;
  /** Hacia dónde está el siguiente paso del camino, visto desde esta celda (para la flecha guía). */
  direction: "right" | "left" | "down" | "end";
}

export function getSnakeColumnCount(totalCount: number): number {
  return Math.max(2, Math.ceil(Math.sqrt(totalCount)));
}

export function getSnakeLayout(totalCount: number, cols: number = getSnakeColumnCount(totalCount)): SnakeCell[] {
  return Array.from({ length: totalCount }, (_, index) => {
    const row = Math.floor(index / cols);
    const colInRow = index % cols;
    const rowIsReversed = row % 2 === 1;
    const col = rowIsReversed ? cols - 1 - colInRow : colInRow;

    const isLast = index === totalCount - 1;
    const nextStartsNewRow = !isLast && (index + 1) % cols === 0;
    const direction: SnakeCell["direction"] = isLast ? "end" : nextStartsNewRow ? "down" : rowIsReversed ? "left" : "right";

    return { row, col, direction };
  });
}
