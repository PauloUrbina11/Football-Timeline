/**
 * Quita el sufijo "(N)" que `get_ballon_dor_match_slots` añade al nombre cuando un jugador se repite
 * dentro de la ventana (ej. "Lionel Messi (5)" → "Lionel Messi") — solo hace falta para calcular
 * iniciales de avatar; el texto completo con el sufijo sigue siendo lo que se muestra en pantalla.
 */
export function stripSlotOrdinalSuffix(label: string): string {
  return label.replace(/\s*\(\d+\)$/, "");
}
