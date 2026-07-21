import { formatElapsed } from "@/features/game-engine/domain/format-elapsed";
import type { Stars } from "@/features/game-engine/domain/scoring";

export interface ShareTextInput {
  /** Fecha del reto en formato YYYY-MM-DD (UTC). */
  challengeDateISO: string;
  /** Cuadrícula de emojis ya calculada server-side (🟩/⬜), nunca el contenido real del timeline. */
  resultGrid: string;
  timeMs: number;
  stars: Stars;
  shareUrl: string;
}

function formatDateLabel(challengeDateISO: string): string {
  const [year, month, day] = challengeDateISO.split("-");
  return `${day}/${month}/${year}`;
}

function formatStarsLine(stars: Stars): string {
  return "⭐".repeat(stars) + "☆".repeat(5 - stars);
}

/** Texto copiable estilo Wordle: sin espóilers del contenido real del timeline. */
export function formatShareText(input: ShareTextInput): string {
  return [
    `Football Timeline — ${formatDateLabel(input.challengeDateISO)}`,
    input.resultGrid,
    `Tiempo: ${formatElapsed(input.timeMs)}`,
    formatStarsLine(input.stars),
    input.shareUrl,
  ].join("\n");
}
