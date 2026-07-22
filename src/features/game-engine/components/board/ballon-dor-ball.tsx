export interface BallonDorBallProps {
  year: string;
  size?: number;
}

/**
 * Balón genérico decorativo (dorado, sin el logotipo real del trofeo "Ballon d'Or" de France
 * Football): el año se muestra en el centro a propósito, es el dato que este modo revela.
 */
export function BallonDorBall({ year, size = 56 }: BallonDorBallProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 35% 30%, #fde68a, #f59e0b 60%, #b45309 100%)",
      }}
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-amber-950 shadow-inner"
    >
      <span style={{ fontSize: size * 0.28 }}>{year}</span>
    </div>
  );
}
