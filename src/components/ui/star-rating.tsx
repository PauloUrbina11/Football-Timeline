"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface StarRatingProps {
  stars: 1 | 2 | 3 | 4 | 5;
  className?: string;
  /** Revela las estrellas una a una en vez de mostrarlas todas de golpe (pantallas de resultado). */
  animate?: boolean;
}

export function StarRating({ stars, className, animate = false }: StarRatingProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} role="img" aria-label={`${stars} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, index) =>
        animate ? (
          <motion.span
            key={index}
            className={index < stars ? "text-accent" : "text-border"}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.12, type: "spring", stiffness: 300, damping: 15 }}
          >
            ★
          </motion.span>
        ) : (
          <span key={index} className={index < stars ? "text-accent" : "text-border"} aria-hidden="true">
            ★
          </span>
        ),
      )}
    </div>
  );
}
