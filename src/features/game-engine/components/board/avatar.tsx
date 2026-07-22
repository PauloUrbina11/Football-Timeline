import { getPaletteColor } from "@/features/game-engine/domain/palette-colors";

export interface AvatarProps {
  name: string;
  size?: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/**
 * Avatar genérico (iniciales sobre un color determinista), NUNCA una foto real de una persona
 * identificable sin licencia — mismo criterio que las camisetas genéricas de Transfer Timeline.
 */
export function Avatar({ name, size = 56 }: AvatarProps) {
  const colors = getPaletteColor(name);

  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size, backgroundColor: colors.main, color: colors.text }}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
    >
      <span style={{ fontSize: size * 0.36 }}>{getInitials(name)}</span>
    </div>
  );
}
