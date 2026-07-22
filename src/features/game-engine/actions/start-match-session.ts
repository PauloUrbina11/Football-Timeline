"use server";

import { createClient } from "@/lib/supabase/server";
import { createGameSession } from "@/features/game-engine/actions/create-game-session";
import type { MatchCardData, SlotLabel } from "@/features/game-engine/domain/types";

export interface StartMatchSessionResult {
  sessionId: string;
  items: MatchCardData[];
  slots: SlotLabel[];
}

interface MatchCardRow {
  event_id: string;
  title: string;
  metadata: Record<string, unknown> | null;
}

interface SlotLabelRow {
  slot_index: number;
  label: string;
}

/**
 * Variante de `startSession` para modos "match" (ver modes-registry.ts): en vez de una lista para
 * ordenar, devuelve elementos sueltos (mezclados, sin año) y casilleros fijos con su año real ya
 * revelado — pero sin decir qué elemento va en cuál. Esa pareja sigue siendo `correct_order`, que
 * el cliente nunca recibe (ver supabase/migrations/0011_match_mode_rpcs.sql).
 */
export async function startMatchSession(timelineId: string, dailyChallengeId?: string): Promise<StartMatchSessionResult> {
  const supabase = await createClient();

  const [cardsResult, slotsResult] = await Promise.all([
    supabase.rpc("get_timeline_match_cards", { p_timeline_id: timelineId }),
    supabase.rpc("get_timeline_slot_labels", { p_timeline_id: timelineId }),
  ]);

  if (cardsResult.error) {
    throw new Error(`No se pudo cargar el timeline: ${cardsResult.error.message}`);
  }
  if (slotsResult.error) {
    throw new Error(`No se pudieron cargar los casilleros: ${slotsResult.error.message}`);
  }

  const cardRows = (cardsResult.data ?? []) as MatchCardRow[];
  const slotRows = (slotsResult.data ?? []) as SlotLabelRow[];

  if (cardRows.length === 0) {
    throw new Error("Este timeline no tiene eventos publicados todavía.");
  }

  const items: MatchCardData[] = cardRows.map((row) => ({
    id: row.event_id,
    title: row.title,
    metadata: row.metadata ?? {},
  }));

  const slots: SlotLabel[] = slotRows.map((row) => ({
    slotIndex: row.slot_index,
    label: row.label,
  }));

  const sessionId = await createGameSession(timelineId, dailyChallengeId);

  return { sessionId, items, slots };
}
