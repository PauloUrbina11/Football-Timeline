"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface CountdownProps {
  seconds?: number;
  onComplete: () => void;
}

/** Cuenta regresiva 3-2-1 antes de que empiece el primer juego del duelo. */
export function Countdown({ seconds = 3, onComplete }: CountdownProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete();
      return;
    }
    const timeout = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
      <p className="text-muted">El duelo empieza en…</p>
      <AnimatePresence mode="wait">
        <motion.span
          key={remaining}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.4 }}
          transition={{ duration: 0.4 }}
          className="text-7xl font-bold text-primary"
        >
          {remaining > 0 ? remaining : "¡Ya!"}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
