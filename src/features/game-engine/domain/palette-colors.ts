export interface PaletteColorScheme {
  main: string;
  accent: string;
  text: string;
}

/**
 * Colores genéricos, NUNCA los colores/escudo/foto reales de ningún club, torneo o persona — es una
 * decisión deliberada (ver docs/architecture.md): evita cualquier problema de marca/trade dress o de
 * derecho de imagen, y evita mantener una tabla club/persona → color real que habría que actualizar
 * a mano por cada entrada nueva. Se usa tanto para camisetas (Jersey) como para avatares (Avatar).
 */
const PALETTE: readonly PaletteColorScheme[] = [
  { main: "#ef4444", accent: "#f2f7f4", text: "#f2f7f4" },
  { main: "#2563eb", accent: "#facc15", text: "#f2f7f4" },
  { main: "#111827", accent: "#f2f7f4", text: "#f2f7f4" },
  { main: "#16a34a", accent: "#f2f7f4", text: "#f2f7f4" },
  { main: "#7c3aed", accent: "#f2f7f4", text: "#f2f7f4" },
  { main: "#0ea5e9", accent: "#0a120e", text: "#0a120e" },
  { main: "#f97316", accent: "#111827", text: "#f2f7f4" },
  { main: "#be123c", accent: "#facc15", text: "#f2f7f4" },
  { main: "#0f766e", accent: "#f2f7f4", text: "#f2f7f4" },
  { main: "#78350f", accent: "#f2f7f4", text: "#f2f7f4" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Determinista: la misma etiqueta (ej. nombre de club o de persona) siempre da el mismo color. */
export function getPaletteColor(label: string): PaletteColorScheme {
  return PALETTE[hashString(label) % PALETTE.length];
}
