"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";
import { useGuessSession, type GuessFinalScore } from "@/features/game-engine/hooks/use-guess-session";
import { useTimer } from "@/features/game-engine/hooks/use-timer";
import { formatElapsed } from "@/features/game-engine/domain/format-elapsed";
import { GUESS_UNIT_LABEL, parseCompactEur, sanitizeGuessNumberInput, type GuessUnit } from "@/features/game-engine/domain/guess-input";
import { cn } from "@/lib/utils";

export interface GuessBoardRenderResultArgs {
  score: GuessFinalScore | null;
  actualValueEur: number;
  gaveUp: boolean;
  attempts: number;
  elapsedMs: number;
}

export interface GuessBoardProps {
  sessionId: string;
  timelineTitle: string;
  renderResult?: (args: GuessBoardRenderResultArgs) => React.ReactNode;
}

const eurFormatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function formatEur(value: number): string {
  return eurFormatter.format(value);
}

export function GuessBoard({ sessionId, timelineTitle, renderResult }: GuessBoardProps) {
  const { history, attempts, maxAttempts, status, finalScore, actualValueEur, errorMessage, guess, giveUp } = useGuessSession(sessionId);
  const [numberStr, setNumberStr] = useState("");
  const [unit, setUnit] = useState<GuessUnit>("M");
  const elapsedMs = useTimer(status !== "finished" && status !== "gave_up");
  const isDone = status === "finished" || status === "gave_up";
  const parsedValue = parseCompactEur(numberStr, unit);
  const lastEntry = status === "playing" ? history[history.length - 1] : undefined;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (parsedValue === null) return;
    setNumberStr("");
    void guess(parsedValue);
  }

  return (
    <AnimatePresence mode="wait">
      {isDone && actualValueEur !== null ? (
        <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {renderResult ? (
            renderResult({ score: finalScore, actualValueEur, gaveUp: status === "gave_up", attempts, elapsedMs })
          ) : (
            <Card data-testid="result-summary" className="flex flex-col items-center gap-4 py-10 text-center">
              <CardTitle>{timelineTitle}</CardTitle>
              <p className="text-lg font-semibold text-foreground">
                {status === "gave_up" ? "El fichaje real fue de" : "¡Acertaste! El fichaje fue de"} {formatEur(actualValueEur)}
              </p>
              {finalScore && (
                <>
                  <StarRating stars={finalScore.stars} className="text-2xl" animate />
                  <p className="text-muted">{finalScore.points} puntos</p>
                </>
              )}
              <dl className="mt-2 grid grid-cols-2 gap-8 text-sm text-muted">
                <div>
                  <dt>Tiempo</dt>
                  <dd className="text-base font-medium text-foreground">{formatElapsed(elapsedMs)}</dd>
                </div>
                <div>
                  <dt>Intentos</dt>
                  <dd className="text-base font-medium text-foreground">{attempts}</dd>
                </div>
              </dl>
            </Card>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="board"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-6"
        >
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              Intentos: {attempts}/{maxAttempts}
            </span>
            <span aria-live="polite">{formatElapsed(elapsedMs)}</span>
          </div>

          <AnimatePresence mode="wait">
            {lastEntry && (lastEntry.result === "higher" || lastEntry.result === "lower") && (
              <motion.div
                key={lastEntry.attemptNumber}
                data-testid="guess-hint-banner"
                data-result={lastEntry.result}
                initial={{ opacity: 0, scale: 0.85, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className={cn(
                  "flex items-center justify-center gap-3 rounded-2xl border-2 py-6 text-center",
                  lastEntry.result === "higher" ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-rose-500 bg-rose-500/10 text-rose-400",
                )}
              >
                <motion.span
                  aria-hidden="true"
                  className="text-4xl"
                  animate={{ y: lastEntry.result === "higher" ? [0, -6, 0] : [0, 6, 0] }}
                  transition={{ duration: 0.6, repeat: 2 }}
                >
                  {lastEntry.result === "higher" ? "⬆️" : "⬇️"}
                </motion.span>
                <span className="text-2xl font-bold tracking-tight">{lastEntry.result === "higher" ? "MÁS ALTO" : "MÁS BAJO"}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              data-testid="guess-input"
              value={numberStr}
              onChange={(event) => setNumberStr(sanitizeGuessNumberInput(event.target.value, numberStr))}
              placeholder="Ej: 222"
              disabled={status === "checking"}
              className="h-11 w-24 rounded-full border border-border bg-surface px-4 text-center text-lg font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <div className="flex overflow-hidden rounded-full border border-border" role="group" aria-label="Unidad">
              {(["k", "M"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  data-testid={`unit-${option}`}
                  onClick={() => setUnit(option)}
                  disabled={status === "checking"}
                  className={cn(
                    "h-11 px-4 text-sm font-semibold transition-colors",
                    unit === option ? "bg-primary text-primary-foreground" : "bg-surface text-muted hover:bg-surface-hover",
                  )}
                >
                  {GUESS_UNIT_LABEL[option]}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={status === "checking" || parsedValue === null}>
              Adivinar
            </Button>
            {parsedValue !== null && <span className="text-sm text-muted">= {formatEur(parsedValue)}</span>}
          </form>

          {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

          <ol className="flex flex-col gap-2" aria-label="Historial de intentos">
            {[...history].reverse().map((entry) => (
              <li
                key={entry.attemptNumber}
                data-testid="guess-history-item"
                data-result={entry.result}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-2 text-sm",
                  entry.result === "correct" ? "border-primary bg-primary/10" : "border-border bg-surface",
                )}
              >
                <span className="font-medium text-foreground">{formatEur(entry.guessValueEur)}</span>
                <span className="text-muted">
                  {entry.result === "correct" ? "✅ ¡Correcto!" : entry.result === "higher" ? "⬆️ más alto" : "⬇️ más bajo"}
                </span>
              </li>
            ))}
          </ol>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => void giveUp()} disabled={status === "checking"}>
              Rendirse
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
