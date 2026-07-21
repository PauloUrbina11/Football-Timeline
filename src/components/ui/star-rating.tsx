import { cn } from "@/lib/utils";

export interface StarRatingProps {
  stars: 1 | 2 | 3 | 4 | 5;
  className?: string;
}

export function StarRating({ stars, className }: StarRatingProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} role="img" aria-label={`${stars} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < stars ? "text-accent" : "text-border"} aria-hidden="true">
          ★
        </span>
      ))}
    </div>
  );
}
