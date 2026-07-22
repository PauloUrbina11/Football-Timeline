import { cn } from "@/lib/utils";

export function ProgressDots({ total, currentIndex }: { total: number; currentIndex: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Juego ${currentIndex + 1} de ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-2.5 w-2.5 rounded-full transition-colors",
            index < currentIndex ? "bg-primary" : index === currentIndex ? "bg-accent" : "bg-border",
          )}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1 text-sm text-muted">
        {Math.min(currentIndex + 1, total)}/{total}
      </span>
    </div>
  );
}
