import type { ModeAccent } from "./modes-registry";

/**
 * Clases Tailwind completas por acento (no se concatenan dinámicamente strings como
 * `border-${accent}`: el escáner de Tailwind no las detectaría).
 */
export const ACCENT_CLASSES: Record<
  ModeAccent,
  { text: string; border: string; ring: string; focusRing: string; bg: string }
> = {
  primary: {
    text: "text-primary",
    border: "border-primary",
    ring: "ring-primary",
    focusRing: "focus-visible:ring-primary",
    bg: "bg-primary",
  },
  accent: {
    text: "text-accent",
    border: "border-accent",
    ring: "ring-accent",
    focusRing: "focus-visible:ring-accent",
    bg: "bg-accent",
  },
  blue: {
    text: "text-mode-blue",
    border: "border-mode-blue",
    ring: "ring-mode-blue",
    focusRing: "focus-visible:ring-mode-blue",
    bg: "bg-mode-blue",
  },
  rose: {
    text: "text-mode-rose",
    border: "border-mode-rose",
    ring: "ring-mode-rose",
    focusRing: "focus-visible:ring-mode-rose",
    bg: "bg-mode-rose",
  },
  violet: {
    text: "text-mode-violet",
    border: "border-mode-violet",
    ring: "ring-mode-violet",
    focusRing: "focus-visible:ring-mode-violet",
    bg: "bg-mode-violet",
  },
  amber: {
    text: "text-mode-amber",
    border: "border-mode-amber",
    ring: "ring-mode-amber",
    focusRing: "focus-visible:ring-mode-amber",
    bg: "bg-mode-amber",
  },
};
