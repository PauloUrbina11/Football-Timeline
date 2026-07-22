import { describe, expect, it } from "vitest";
import {
  createInitialMatchState,
  isMatchComplete,
  placeItem,
  removeFromSlot,
  toSubmittedOrder,
} from "./match-placement";

describe("placeItem", () => {
  it("coloca un elemento del pool en un casillero vacío", () => {
    const state = createInitialMatchState(["a", "b", "c"], 3);
    const next = placeItem(state, "a", 1);
    expect(next.pool).toEqual(["b", "c"]);
    expect(next.placements).toEqual(["a", null, null]);
  });

  it("si el casillero destino ya tenía algo, ese ocupante rebota al pool", () => {
    let state = createInitialMatchState(["a", "b", "c"], 3);
    state = placeItem(state, "a", 1);
    state = placeItem(state, "b", 1); // "a" debería volver al pool
    expect(state.placements).toEqual(["b", null, null]);
    expect(state.pool.sort()).toEqual(["a", "c"]);
  });

  it("mover un elemento ya colocado a otro casillero lo saca del primero", () => {
    let state = createInitialMatchState(["a", "b"], 2);
    state = placeItem(state, "a", 1);
    state = placeItem(state, "a", 2);
    expect(state.placements).toEqual([null, "a"]);
    expect(state.pool).toEqual(["b"]);
  });
});

describe("removeFromSlot", () => {
  it("devuelve el elemento del casillero al pool", () => {
    let state = createInitialMatchState(["a"], 1);
    state = placeItem(state, "a", 1);
    state = removeFromSlot(state, 1);
    expect(state.placements).toEqual([null]);
    expect(state.pool).toEqual(["a"]);
  });

  it("no hace nada si el casillero ya estaba vacío", () => {
    const state = createInitialMatchState(["a"], 1);
    expect(removeFromSlot(state, 1)).toEqual(state);
  });
});

describe("isMatchComplete / toSubmittedOrder", () => {
  it("no está completo si hay casilleros vacíos", () => {
    let state = createInitialMatchState(["a", "b"], 2);
    state = placeItem(state, "a", 1);
    expect(isMatchComplete(state)).toBe(false);
    expect(() => toSubmittedOrder(state)).toThrow();
  });

  it("está completo cuando todos los casilleros tienen algo, y arma el array en orden", () => {
    let state = createInitialMatchState(["a", "b"], 2);
    state = placeItem(state, "b", 1);
    state = placeItem(state, "a", 2);
    expect(isMatchComplete(state)).toBe(true);
    expect(toSubmittedOrder(state)).toEqual(["b", "a"]);
  });
});
