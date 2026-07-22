"use client";

import { useEffect, useState } from "react";
import { formatElapsed } from "@/features/game-engine/domain/format-elapsed";
import { cn } from "@/lib/utils";

export interface PvpCountdownTimerProps {
  endsAt: string;
}

/**
 * Cuenta regresiva visible del plazo del juego actual — puramente informativa. El cierre real
 * (0 puntos si se agota el tiempo) ya lo decide el servidor (`advance_pvp_game`, ver
 * use-pvp-match.ts), este componente solo pinta lo que ya es autoritativo desde `endsAt`.
 */
export function PvpCountdownTimer({ endsAt }: PvpCountdownTimerProps) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(endsAt).getTime() - Date.now());

  useEffect(() => {
    const tick = () => setRemainingMs(Math.max(0, new Date(endsAt).getTime() - Date.now()));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  const isLow = remainingMs <= 10_000;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold tabular-nums",
        isLow ? "border-danger text-danger" : "border-border text-foreground",
      )}
      aria-live="polite"
    >
      ⏱ {formatElapsed(Math.max(0, remainingMs))}
    </span>
  );
}
