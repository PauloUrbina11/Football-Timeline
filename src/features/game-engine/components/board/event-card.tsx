"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { EventCardData } from "@/features/game-engine/domain/types";
import type { CardCheckState } from "@/features/game-engine/hooks/use-game-session";
import type { CardVariant, ModeAccent } from "@/features/game-engine/domain/modes-registry";
import { ACCENT_CLASSES } from "@/features/game-engine/domain/accent-classes";

export interface EventCardProps {
  event: EventCardData;
  position: number;
  state: CardCheckState;
  accent: ModeAccent;
  cardVariant?: CardVariant;
}

const stateBorderClasses: Record<CardCheckState, string> = {
  idle: "border-border",
  correct: "border-primary ring-1 ring-primary",
  incorrect: "border-danger ring-1 ring-danger",
};

function getFlags(event: EventCardData): [string, string] | null {
  const flags = event.metadata.flags;
  return Array.isArray(flags) && flags.length === 2 ? (flags as [string, string]) : null;
}

// Deliberadamente NO se renderiza `event.displayDate` (revelaría el orden). Tampoco se recibe
// `description` del servidor durante el juego: ver get_timeline_play_cards en supabase/migrations.
export function EventCard({ event, position, state, accent, cardVariant = "text" }: EventCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: event.id });
  const accentClasses = ACCENT_CLASSES[accent];
  const flags = cardVariant === "flags" ? getFlags(event) : null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid="event-card"
      data-event-id={event.id}
      data-state={state}
      className={cn(
        "flex touch-none select-none items-center gap-4 rounded-xl border bg-surface p-4 outline-none",
        "cursor-grab transition-colors active:cursor-grabbing focus-visible:ring-2",
        accentClasses.focusRing,
        state === "idle" ? "border-border" : stateBorderClasses[state],
        isDragging && "opacity-60 shadow-lg",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-sm font-semibold",
          accentClasses.text,
        )}
      >
        {position}
      </span>
      <div className="flex-1">
        {flags ? (
          <p className="flex items-center justify-center gap-3 text-2xl" aria-label="Partido">
            <span>{flags[0]}</span>
            <span className="text-sm font-medium text-muted">vs</span>
            <span>{flags[1]}</span>
          </p>
        ) : (
          <p className="font-medium text-foreground">{event.title}</p>
        )}
      </div>
      {state === "correct" && (
        <span aria-label="Posición correcta" className="text-lg text-primary">
          ✓
        </span>
      )}
      {state === "incorrect" && (
        <span aria-label="Posición incorrecta" className="text-lg text-danger">
          ✕
        </span>
      )}
    </li>
  );
}
