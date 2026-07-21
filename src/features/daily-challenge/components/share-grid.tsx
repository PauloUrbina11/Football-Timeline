export interface ShareGridProps {
  grid: string;
}

/** Cuadrícula de emojis (🟩/⬜) ya calculada server-side: nunca revela el contenido real del timeline. */
export function ShareGrid({ grid }: ShareGridProps) {
  return (
    <p className="text-2xl leading-relaxed tracking-widest" aria-label={`Resultado: ${grid}`}>
      {grid}
    </p>
  );
}
