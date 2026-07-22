"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { findPvpMatch } from "@/features/pvp/actions/find-match";
import { cancelPvpSearch } from "@/features/pvp/actions/cancel-search";
import { getActivePvpMatch } from "@/features/pvp/actions/get-active-match";
import { createPvpRoom } from "@/features/pvp/actions/create-room";
import { joinPvpRoom } from "@/features/pvp/actions/join-room";

export type PvpQueueStatus = "idle" | "searching" | "matched" | "error";

/**
 * Cola de matchmaking (ver plan de arquitectura del módulo PvP): entra a la cola (FIFO al azar o
 * una sala privada por código) y escucha en tiempo real la fila propia de `pvp_queue` (sin
 * polling) hasta que `status` pase a "matched", con un respaldo por si el cambio ocurrió en la
 * ventana antes de que la suscripción quedara activa (`getActivePvpMatch`, la misma consulta que
 * ya sirve para reconexión).
 */
export function usePvpQueue() {
  const [status, setStatus] = useState<PvpQueueStatus>("idle");
  const [queueId, setQueueId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const search = useCallback(async (guestAlias?: string) => {
    setStatus("searching");
    setErrorMessage(null);
    setRoomCode(null);
    try {
      const result = await findPvpMatch(guestAlias);
      if (result.status === "matched" && result.matchId) {
        setMatchId(result.matchId);
        setStatus("matched");
        return;
      }
      setQueueId(result.queueId ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo buscar partida.");
      setStatus("error");
    }
  }, []);

  const createRoom = useCallback(async (guestAlias?: string) => {
    setStatus("searching");
    setErrorMessage(null);
    try {
      const result = await createPvpRoom(guestAlias);
      setRoomCode(result.roomCode);
      setQueueId(result.queueId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear la sala.");
      setStatus("error");
    }
  }, []);

  const joinRoom = useCallback(async (code: string, guestAlias?: string) => {
    setStatus("searching");
    setErrorMessage(null);
    setRoomCode(null);
    try {
      const result = await joinPvpRoom(code, guestAlias);
      setMatchId(result.matchId);
      setStatus("matched");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo unir a la sala.");
      setStatus("error");
    }
  }, []);

  const cancel = useCallback(async () => {
    setStatus("idle");
    setQueueId(null);
    setRoomCode(null);
    await cancelPvpSearch().catch(() => {});
  }, []);

  useEffect(() => {
    if (status !== "searching" || !queueId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`pvp_queue_${queueId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pvp_queue", filter: `id=eq.${queueId}` },
        (payload) => {
          const row = payload.new as { status: string; matched_match_id: string | null };
          if (row.status === "matched" && row.matched_match_id) {
            setMatchId(row.matched_match_id);
            setStatus("matched");
          }
        },
      )
      .subscribe();

    // Respaldo: cubre la ventana entre "enqueue_pvp_match devolvió waiting" y "la suscripción de
    // Realtime ya quedó activa" — sin esto, un emparejamiento que ocurra justo en ese instante se
    // perdería silenciosamente.
    const pollTimeout = setTimeout(() => {
      getActivePvpMatch()
        .then((activeMatchId) => {
          if (activeMatchId) {
            setMatchId(activeMatchId);
            setStatus("matched");
          }
        })
        .catch(() => {});
    }, 1200);

    return () => {
      clearTimeout(pollTimeout);
      supabase.removeChannel(channel);
    };
  }, [status, queueId]);

  return { status, matchId, roomCode, errorMessage, search, createRoom, joinRoom, cancel };
}
