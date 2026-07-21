"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { useGameSession } from "@/features/game-engine/hooks/use-game-session";
import { useTimer } from "@/features/game-engine/hooks/use-timer";
import { formatElapsed } from "@/features/game-engine/domain/format-elapsed";
import type { EventCardData } from "@/features/game-engine/domain/types";
import type { ModeAccent } from "@/features/game-engine/domain/modes-registry";
import { EventCard } from "./event-card";
import { ResultSummary } from "./result-summary";
import type { FinalScore } from "@/features/game-engine/hooks/use-game-session";

export interface TimelineBoardRenderResultArgs {
  score: FinalScore;
  attempts: number;
  elapsedMs: number;
}

export interface TimelineBoardProps {
  sessionId: string;
  initialCards: EventCardData[];
  timelineTitle: string;
  accent?: ModeAccent;
  /** Si se indica, sustituye el <ResultSummary> por defecto (lo usa /daily para mostrar el share). */
  renderResult?: (args: TimelineBoardRenderResultArgs) => React.ReactNode;
}

export function TimelineBoard({
  sessionId,
  initialCards,
  timelineTitle,
  accent = "primary",
  renderResult,
}: TimelineBoardProps) {
  const { cards, cardStates, attempts, status, finalScore, errorMessage, reorder, shuffle, checkOrder } =
    useGameSession(sessionId, initialCards);

  const elapsedMs = useTimer(status !== "finished");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = cards.findIndex((card) => card.id === active.id);
    const toIndex = cards.findIndex((card) => card.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;

    reorder(fromIndex, toIndex);
  }

  return (
    <AnimatePresence mode="wait">
      {status === "finished" && finalScore ? (
        <motion.div
          key="result"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderResult ? (
            renderResult({ score: finalScore, attempts, elapsedMs })
          ) : (
            <ResultSummary
              timelineTitle={timelineTitle}
              totalEvents={cards.length}
              attempts={attempts}
              elapsedMs={elapsedMs}
              points={finalScore.points}
              stars={finalScore.stars}
            />
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
            <span>Intentos: {attempts}</span>
            <span aria-live="polite">{formatElapsed(elapsedMs)}</span>
          </div>

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-3">
                {cards.map((card, index) => (
                  <EventCard key={card.id} event={card} position={index + 1} state={cardStates[index]} accent={accent} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>

          {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={shuffle} disabled={status === "checking"}>
              Reiniciar
            </Button>
            <Button onClick={checkOrder} disabled={status === "checking"}>
              {status === "checking" ? "Comprobando…" : "Comprobar"}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
