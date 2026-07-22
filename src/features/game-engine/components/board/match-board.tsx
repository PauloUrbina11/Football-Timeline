"use client";

import { AnimatePresence, motion } from "framer-motion";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { useMatchSession } from "@/features/game-engine/hooks/use-match-session";
import { useTimer } from "@/features/game-engine/hooks/use-timer";
import { formatElapsed } from "@/features/game-engine/domain/format-elapsed";
import { cn } from "@/lib/utils";
import type { MatchCardData, SlotLabel } from "@/features/game-engine/domain/types";
import type { MatchVariant, ModeAccent } from "@/features/game-engine/domain/modes-registry";
import type { CardCheckState, FinalScore } from "@/features/game-engine/hooks/use-game-session";
import { ACCENT_CLASSES } from "@/features/game-engine/domain/accent-classes";
import { stripSlotOrdinalSuffix } from "@/features/game-engine/domain/slot-label";
import { Jersey } from "./jersey";
import { BallonDorBall } from "./ballon-dor-ball";
import { Avatar } from "./avatar";
import { ResultSummary } from "./result-summary";

export interface MatchBoardRenderResultArgs {
  score: FinalScore;
  attempts: number;
  elapsedMs: number;
}

export interface MatchBoardProps {
  sessionId: string;
  items: MatchCardData[];
  slots: SlotLabel[];
  timelineTitle: string;
  accent?: ModeAccent;
  matchVariant?: MatchVariant;
  renderResult?: (args: MatchBoardRenderResultArgs) => React.ReactNode;
}

function itemLabel(item: MatchCardData): string {
  const club = item.metadata.club;
  return typeof club === "string" ? club : item.title;
}

function ItemToken({ item, matchVariant, size }: { item: MatchCardData; matchVariant: MatchVariant; size: number }) {
  // El color de la camiseta se deriva del club SIN el sufijo "(N)" (ver stripSlotOrdinalSuffix):
  // dos etapas en el mismo club deben verse del mismo color, la etiqueta de abajo ya distingue cuál es cuál.
  return matchVariant === "name-slots" ? (
    <BallonDorBall year={item.title} size={size} />
  ) : (
    <Jersey label={stripSlotOrdinalSuffix(itemLabel(item))} size={size} />
  );
}

function DraggableItem({ item, matchVariant, disabled }: { item: MatchCardData; matchVariant: MatchVariant; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id, disabled });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      data-testid="match-item"
      data-event-id={item.id}
      className={cn(
        "flex w-24 touch-none select-none flex-col items-center gap-1 rounded-lg border border-border bg-surface p-2 outline-none",
        "cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary",
        isDragging && "opacity-60",
      )}
    >
      <ItemToken item={item} matchVariant={matchVariant} size={48} />
      {matchVariant !== "name-slots" && (
        <span className="text-center text-xs leading-tight text-foreground break-words">{itemLabel(item)}</span>
      )}
    </button>
  );
}

function MatchSlot({
  slot,
  placedItem,
  state,
  accent,
  matchVariant,
  onRemove,
}: {
  slot: SlotLabel;
  placedItem: MatchCardData | null;
  state: CardCheckState;
  accent: ModeAccent;
  matchVariant: MatchVariant;
  onRemove: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot.slotIndex}` });
  const accentClasses = ACCENT_CLASSES[accent];

  const stateBorder =
    state === "correct" ? "border-primary ring-1 ring-primary" : state === "incorrect" ? "border-danger ring-1 ring-danger" : "border-border";

  return (
    <div
      ref={setNodeRef}
      data-testid="match-slot"
      data-slot-index={slot.slotIndex}
      data-state={state}
      className={cn(
        "flex min-h-28 w-32 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed bg-surface p-2 py-3",
        stateBorder,
        isOver && "bg-surface-hover",
      )}
    >
      {matchVariant === "name-slots" && <Avatar name={stripSlotOrdinalSuffix(slot.label)} size={28} />}
      <span className={cn("text-center text-xs font-semibold leading-tight break-words", accentClasses.text)}>{slot.label}</span>
      {placedItem ? (
        <div className="relative flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label={`Quitar ${itemLabel(placedItem)} del casillero`}
            onClick={onRemove}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-surface-hover text-xs text-muted hover:text-foreground"
          >
            ✕
          </button>
          <ItemToken item={placedItem} matchVariant={matchVariant} size={40} />
        </div>
      ) : (
        <span className="text-xs text-muted">vacío</span>
      )}
    </div>
  );
}

export function MatchBoard({
  sessionId,
  items,
  slots,
  timelineTitle,
  accent = "primary",
  matchVariant = "year-slots",
  renderResult,
}: MatchBoardProps) {
  const { pool, placements, slotStates, attempts, status, finalScore, errorMessage, isComplete, place, unplace, reset, checkOrder } =
    useMatchSession(
      sessionId,
      items.map((item) => item.id),
      slots.length,
    );

  const elapsedMs = useTimer(status !== "finished");
  const itemsById = new Map(items.map((item) => [item.id, item]));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const match = /^slot-(\d+)$/.exec(String(over.id));
    if (!match) return;
    place(String(active.id), Number(match[1]));
  }

  return (
    <AnimatePresence mode="wait">
      {status === "finished" && finalScore ? (
        <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {renderResult ? (
            renderResult({ score: finalScore, attempts, elapsedMs })
          ) : (
            <ResultSummary
              timelineTitle={timelineTitle}
              totalEvents={slots.length}
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

          <DndContext onDragEnd={handleDragEnd}>
            <div>
              <p className="mb-2 text-sm text-muted">Casilleros</p>
              <div className="flex flex-wrap gap-3">
                {slots.map((slot, index) => (
                  <MatchSlot
                    key={slot.slotIndex}
                    slot={slot}
                    placedItem={placements[index] ? itemsById.get(placements[index] as string) ?? null : null}
                    state={slotStates[index]}
                    accent={accent}
                    matchVariant={matchVariant}
                    onRemove={() => unplace(slot.slotIndex)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-muted">Por colocar</p>
              <div className="flex min-h-24 flex-wrap gap-3">
                {pool.map((eventId) => {
                  const item = itemsById.get(eventId);
                  return item ? (
                    <DraggableItem key={eventId} item={item} matchVariant={matchVariant} disabled={status === "checking"} />
                  ) : null;
                })}
                {pool.length === 0 && <p className="text-sm text-muted">Todo colocado.</p>}
              </div>
            </div>
          </DndContext>

          {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={reset} disabled={status === "checking"}>
              Reiniciar
            </Button>
            <Button onClick={checkOrder} disabled={!isComplete || status === "checking"}>
              {status === "checking" ? "Comprobando…" : "Comprobar"}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
