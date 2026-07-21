"use client";

import { useEffect, useRef, useState } from "react";
import { startSession } from "@/features/game-engine/actions/start-session";
import type { EventCardData } from "@/features/game-engine/domain/types";
import { TimelineBoard } from "./timeline-board";

export interface PlayTimelineClientProps {
  timelineId: string;
  timelineTitle: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; sessionId: string; cards: EventCardData[] }
  | { status: "error"; message: string };

/**
 * Arranca la sesión de juego desde el cliente (no desde el Server Component de la página):
 * `startSession` necesita poder escribir la cookie de `anon_id`, y Next.js solo permite mutar
 * cookies dentro de una invocación real de Server Action, no durante el render de una página.
 */
export function PlayTimelineClient({ timelineId, timelineTitle }: PlayTimelineClientProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Sin guarda, React (Strict Mode, solo en dev) dispararía este efecto dos veces y crearía dos
    // game_sessions por carga de página. Deliberadamente sin guarda de "isMounted" adicional: ver
    // la nota en daily-result.tsx sobre por qué esa combinación descarta la respuesta real.
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    startSession(timelineId)
      .then(({ sessionId, cards }) => {
        setState({ status: "ready", sessionId, cards });
      })
      .catch((error: unknown) => {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "No se pudo iniciar la partida.",
        });
      });
  }, [timelineId]);

  if (state.status === "loading") {
    return <p className="text-muted">Cargando partida…</p>;
  }

  if (state.status === "error") {
    return <p className="text-danger">{state.message}</p>;
  }

  return <TimelineBoard sessionId={state.sessionId} initialCards={state.cards} timelineTitle={timelineTitle} />;
}
