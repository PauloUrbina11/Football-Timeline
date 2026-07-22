import { getJerseyColors } from "@/features/game-engine/domain/jersey-colors";

export interface JerseyProps {
  label: string;
  size?: number;
}

/**
 * Camiseta genérica (sin escudo ni patrocinador): un color por club, determinista, decorativo.
 * El nombre del club se muestra debajo como texto, así el color nunca es la única pista.
 */
export function Jersey({ label, size = 64 }: JerseyProps) {
  const colors = getJerseyColors(label);

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M20 4 L8 14 L14 24 L20 20 L20 58 A2 2 0 0 0 22 60 L42 60 A2 2 0 0 0 44 58 L44 20 L50 24 L56 14 L44 4 L38 8 L26 8 Z"
        fill={colors.main}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="1"
      />
      <rect x="20" y="30" width="24" height="6" fill={colors.accent} opacity="0.85" />
    </svg>
  );
}
