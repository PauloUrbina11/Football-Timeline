"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";
import { useGuessSession, type GuessFinalScore } from "@/features/game-engine/hooks/use-guess-session";
import { useTimer } from "@/features/game-engine/hooks/use-timer";
import { formatElapsed } from "@/features/game-engine/domain/format-elapsed";
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

const resultHint: Record<"higher" | "lower" | "correct", { icon: string; text: string }> = {
  higher: { icon: "⬆️", text: "El valor real es más alto" },
  lower: { icon: "⬇️", text: "El valor real es más bajo" },
  correct: { icon: "✅", text: "¡Correcto!" },
};

export function GuessBoard({ sessionId, timelineTitle, renderResult }: GuessBoardProps) {
  const { history, attempts, maxAttempts, status, finalScore, actualValueEur, errorMessage, guess, giveUp } = useGuessSession(sessionId);
  const [inputValue, setInputValue] = useState("");
  const elapsedMs = useTimer(status !== "finished" && status !== "gave_up");
  const isDone = status === "finished" || status === "gave_up";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(inputValue.replace(/[^\d]/g, ""));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setInputValue("");
    void guess(parsed);
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

          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              inputMode="numeric"
              data-testid="guess-input"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Ej: 50000000"
              disabled={status === "checking"}
              className="h-11 flex-1 rounded-full border border-border bg-surface px-5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <Button type="submit" disabled={status === "checking" || inputValue.trim() === ""}>
              Adivinar
            </Button>
          </form>

          {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

          <ol className="flex flex-col gap-2" aria-label="Historial de intentos">
            {[...history].reverse().map((entry) => {
              const hint = resultHint[entry.result];
              return (
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
                    {hint.icon} {hint.text}
                  </span>
                </li>
              );
            })}
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
