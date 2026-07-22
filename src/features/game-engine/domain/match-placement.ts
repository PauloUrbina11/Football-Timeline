export interface MatchState {
  /** IDs de evento todavía sin colocar, en el orden en que se muestran. */
  pool: string[];
  /** Un elemento por casillero (índice 0 = casillero 1); `null` = vacío. */
  placements: (string | null)[];
}

export function createInitialMatchState(itemIds: string[], slotCount: number): MatchState {
  return { pool: [...itemIds], placements: Array.from({ length: slotCount }, () => null) };
}

/**
 * Coloca `eventId` en el casillero `slotIndex` (1-based). Si el casillero ya tenía algo, ese
 * ocupante "rebota" de vuelta al pool (semántica simple: no hace falta rastrear de dónde venía
 * el elemento arrastrado para hacer un intercambio verdadero).
 */
export function placeItem(state: MatchState, eventId: string, slotIndex: number): MatchState {
  const targetIdx = slotIndex - 1;
  const occupant = state.placements[targetIdx];

  const pool = state.pool.filter((id) => id !== eventId);
  const placements = state.placements.map((id) => (id === eventId ? null : id));

  if (occupant && occupant !== eventId) {
    pool.push(occupant);
  }

  placements[targetIdx] = eventId;
  return { pool, placements };
}

/** Devuelve el elemento de `slotIndex` (1-based) de vuelta al pool. No hace nada si ya está vacío. */
export function removeFromSlot(state: MatchState, slotIndex: number): MatchState {
  const idx = slotIndex - 1;
  const eventId = state.placements[idx];
  if (!eventId) {
    return state;
  }
  const placements = [...state.placements];
  placements[idx] = null;
  return { pool: [...state.pool, eventId], placements };
}

export function isMatchComplete(state: MatchState): boolean {
  return state.placements.every((id) => id !== null);
}

/** El array a enviar a `submit_attempt`: uno por casillero, en orden. Solo válido si `isMatchComplete`. */
export function toSubmittedOrder(state: MatchState): string[] {
  return state.placements.map((id) => {
    if (!id) {
      throw new Error("No se puede comprobar: todavía hay casilleros vacíos.");
    }
    return id;
  });
}

export function shufflePool(pool: string[]): string[] {
  const next = [...pool];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
