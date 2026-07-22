"use server";

import { createClient } from "@/lib/supabase/server";
import { createGameSession } from "@/features/game-engine/actions/create-game-session";
import type { MatchVariant } from "@/features/game-engine/domain/modes-registry";
import type { MatchCardData, SlotLabel } from "@/features/game-engine/domain/types";

export interface StartMatchSessionResult {
  sessionId: string;
  items: MatchCardData[];
  slots: SlotLabel[];
}

interface MatchItemRow {
  event_id: string;
  title?: string;
  label?: string;
  metadata?: Record<string, unknown> | null;
}

interface SlotLabelRow {
  slot_index: number;
  label: string;
}

const RPC_BY_VARIANT: Record<MatchVariant, { items: string; slots: string }> = {
  // Transfer: casilleros revelan el año; los elementos ocultan la identidad (camiseta genérica).
  "year-slots": { items: "get_timeline_match_cards", slots: "get_timeline_slot_labels" },
  // Ballon d'Or: al revés — los elementos ya revelan el año (balón); los casilleros revelan el
  // nombre. `get_ballon_dor_match_slots` (no la genérica `get_timeline_match_slots_by_name`) porque
  // además desambigua jugadores repetidos dentro de la ventana con su ordinal de carrera real
  // ("Messi (5)") — es lógica específica de Ballon d'Or, hoy el único consumidor de "name-slots".
  "name-slots": { items: "get_timeline_match_items_by_year", slots: "get_ballon_dor_match_slots" },
};

/**
 * Variante de `startSession` para modos "match" (ver modes-registry.ts): en vez de una lista para
 * ordenar, devuelve elementos sueltos (mezclados) y casilleros fijos, cada lado revelando un dato
 * real distinto según `matchVariant` — pero nunca la pareja evento↔casillero, que sigue siendo
 * `correct_order` y el cliente nunca recibe (ver supabase/migrations/0011 y 0012).
 */
export async function startMatchSession(
  timelineId: string,
  dailyChallengeId?: string,
  matchVariant: MatchVariant = "year-slots",
  pvpMatchGameId?: string,
): Promise<StartMatchSessionResult> {
  const supabase = await createClient();
  const rpcNames = RPC_BY_VARIANT[matchVariant];

  const [itemsResult, slotsResult] = await Promise.all([
    supabase.rpc(rpcNames.items, { p_timeline_id: timelineId }),
    supabase.rpc(rpcNames.slots, { p_timeline_id: timelineId }),
  ]);

  if (itemsResult.error) {
    throw new Error(`No se pudo cargar el timeline: ${itemsResult.error.message}`);
  }
  if (slotsResult.error) {
    throw new Error(`No se pudieron cargar los casilleros: ${slotsResult.error.message}`);
  }

  const itemRows = (itemsResult.data ?? []) as MatchItemRow[];
  const slotRows = (slotsResult.data ?? []) as SlotLabelRow[];

  if (itemRows.length === 0) {
    throw new Error("Este timeline no tiene eventos publicados todavía.");
  }

  const items: MatchCardData[] = itemRows.map((row) => ({
    id: row.event_id,
    title: row.title ?? row.label ?? "",
    metadata: row.metadata ?? {},
  }));

  const slots: SlotLabel[] = slotRows.map((row) => ({
    slotIndex: row.slot_index,
    label: row.label,
  }));

  const sessionId = await createGameSession(timelineId, dailyChallengeId, pvpMatchGameId);

  return { sessionId, items, slots };
}
