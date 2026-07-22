export interface JerseyColorScheme {
  main: string;
  accent: string;
  text: string;
}

/**
 * Colores genéricos, NO los colores oficiales de ningún club — es una decisión deliberada
 * (ver docs/architecture.md): evita cualquier problema de marca/trade dress, y evita mantener
 * una tabla club → color real que habría que actualizar a mano por cada club nuevo.
 */
const PALETTE: readonly JerseyColorScheme[] = [
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

/** Determinista: la misma etiqueta (ej. nombre de club) siempre da el mismo color. */
export function getJerseyColors(label: string): JerseyColorScheme {
  return PALETTE[hashString(label) % PALETTE.length];
}
