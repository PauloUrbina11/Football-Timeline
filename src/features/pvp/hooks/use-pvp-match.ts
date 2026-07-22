"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getPvpMatchState } from "@/features/pvp/actions/get-match-state";
import { advancePvpGame } from "@/features/pvp/actions/advance-game";
import { leavePvpMatch } from "@/features/pvp/actions/leave-match";
import { sendPvpHeartbeat } from "@/features/pvp/actions/send-heartbeat";
import type { PvpMatchState } from "@/features/pvp/domain/types";

/**
 * Estado en vivo de un duelo. Nunca reconstruye el resultado a partir de un payload de Realtime:
 * escucha `pvp_matches`/`pvp_match_games`/`pvp_match_players` (públicas, ver 0019) solo como
 * señal de "algo cambió" y siempre refresca llamando a `get_pvp_match_state` (aplica la regla
 * anti-espionaje del rival en el propio servidor).
 */
export function usePvpMatch(matchId: string, initialState: PvpMatchState | null = null) {
  const [state, setState] = useState<PvpMatchState | null>(initialState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    getPvpMatchState(matchId)
      .then(setState)
      .catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar la partida."));
  }, [matchId]);

  useEffect(() => {
    if (!initialState) refresh();
    // Solo debe correr al montar (o si cambia matchId) — `initialState` es una foto inicial, no
    // debe volver a disparar el efecto en cada actualización posterior de `state`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    const supabase = createClient();

    function scheduleRefresh() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(refresh, 150);
    }

    const channel = supabase
      .channel(`pvp_match_${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pvp_matches", filter: `id=eq.${matchId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "pvp_match_games", filter: `match_id=eq.${matchId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "pvp_match_players", filter: `match_id=eq.${matchId}` }, scheduleRefresh)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [matchId, refresh]);

  useEffect(() => {
    if (state?.status !== "in_progress") return;
    void sendPvpHeartbeat(matchId);
    const interval = setInterval(() => void sendPvpHeartbeat(matchId), 15_000);
    return () => clearInterval(interval);
  }, [matchId, state?.status]);

  useEffect(() => {
    if (!state || state.status !== "in_progress") return;
    const currentGame = state.games.find((game) => game.gameIndex === state.currentGameIndex);
    if (!currentGame || currentGame.status !== "active" || !currentGame.endsAt) return;

    const msRemaining = new Date(currentGame.endsAt).getTime() - Date.now();
    const timeout = setTimeout(
      () => {
        advancePvpGame(matchId, currentGame.gameIndex).then(setState).catch(() => {});
      },
      Math.max(0, msRemaining) + 250,
    );
    return () => clearTimeout(timeout);
  }, [matchId, state]);

  const leave = useCallback(async () => {
    const next = await leavePvpMatch(matchId);
    setState(next);
    return next;
  }, [matchId]);

  // Se expone el propio setter: cuando una action (p.ej. reportPvpGameResult) ya trae de vuelta el
  // estado más fresco en su respuesta, no hace falta esperar la ronda de Realtime + debounce para
  // aplicarlo — sí seguimos escuchando Realtime para lo que dispare el RIVAL, que esta pestaña no
  // puede conocer por su propia respuesta.
  return { state, errorMessage, refresh, leave, applyState: setState };
}
