"use client";

import { useEffect, useRef, useState } from "react";

/** Cronómetro simple: cuenta desde que `isRunning` se vuelve `true`, se congela cuando pasa a `false`. */
export function useTimer(isRunning: boolean): number {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now() - elapsedMs;
    }
    const startedAt = startedAtRef.current;

    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 200);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  return elapsedMs;
}
