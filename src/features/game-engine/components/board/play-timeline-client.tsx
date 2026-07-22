"use client";

import { useEffect, useRef, useState } from "react";
import { startSession } from "@/features/game-engine/actions/start-session";
import { startMatchSession } from "@/features/game-engine/actions/start-match-session";
import { getGameMode } from "@/features/game-engine/domain/modes-registry";
import type { EventCardData, MatchCardData, SlotLabel } from "@/features/game-engine/domain/types";
import { TimelineBoard } from "./timeline-board";
import { MatchBoard } from "./match-board";

export interface PlayTimelineClientProps {
  timelineId: string;
  timelineTitle: string;
  modeId: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready-sort"; sessionId: string; cards: EventCardData[] }
  | { status: "ready-match"; sessionId: string; items: MatchCardData[]; slots: SlotLabel[] }
  | { status: "error"; message: string };

/**
 * Arranca la sesión de juego desde el cliente (no desde el Server Component de la página):
 * `startSession`/`startMatchSession` necesitan poder escribir la cookie de `anon_id`, y Next.js
 * solo permite mutar cookies dentro de una invocación real de Server Action, no durante el render
 * de una página.
 */
export function PlayTimelineClient({ timelineId, timelineTitle, modeId }: PlayTimelineClientProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const hasStartedRef = useRef(false);
  const mode = getGameMode(modeId);

  useEffect(() => {
    // Sin guarda, React (Strict Mode, solo en dev) dispararía este efecto dos veces y crearía dos
    // game_sessions por carga de página. Deliberadamente sin guarda de "isMounted" adicional: ver
    // la nota en daily-result.tsx sobre por qué esa combinación descarta la respuesta real.
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const load =
      mode?.interaction === "match"
        ? startMatchSession(timelineId).then(({ sessionId, items, slots }) =>
            setState({ status: "ready-match", sessionId, items, slots }),
          )
        : startSession(timelineId).then(({ sessionId, cards }) => setState({ status: "ready-sort", sessionId, cards }));

    load.catch((error: unknown) => {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "No se pudo iniciar la partida.",
      });
    });
  }, [timelineId, mode?.interaction]);

  if (state.status === "loading") {
    return <p className="text-muted">Cargando partida…</p>;
  }

  if (state.status === "error") {
    return <p className="text-danger">{state.message}</p>;
  }

  if (state.status === "ready-match") {
    return (
      <MatchBoard
        sessionId={state.sessionId}
        items={state.items}
        slots={state.slots}
        timelineTitle={timelineTitle}
        accent={mode?.accent}
      />
    );
  }

  return <TimelineBoard sessionId={state.sessionId} initialCards={state.cards} timelineTitle={timelineTitle} accent={mode?.accent} />;
}
