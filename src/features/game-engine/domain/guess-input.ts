export type GuessUnit = "k" | "M";

export const GUESS_UNIT_MULTIPLIER: Record<GuessUnit, number> = { k: 1_000, M: 1_000_000 };
export const GUESS_UNIT_LABEL: Record<GuessUnit, string> = { k: "mil", M: "M" };

/**
 * Máximo 3 dígitos (sin contar la coma decimal) — escribir "222" o "24,3", nunca el valor completo
 * en euros con todos los ceros. Devuelve `previous` si `raw` violaría esa cota (bloquea la tecla en
 * vez de truncar, así el cursor/valor no salta de forma rara mientras se escribe).
 */
export function sanitizeGuessNumberInput(raw: string, previous: string): string {
  const candidate = raw.replace(/[^\d,]/g, "");
  if (candidate.split(",").length > 2) return previous;
  const digitsOnly = candidate.replace(",", "");
  if (digitsOnly.length > 3) return previous;
  return candidate;
}

/** `("24,3", "M")` → 24300000. `null` si `numberStr` está vacío o no es un número válido. */
export function parseCompactEur(numberStr: string, unit: GuessUnit): number | null {
  if (!numberStr) return null;
  const normalized = numberStr.replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * GUESS_UNIT_MULTIPLIER[unit]);
}
