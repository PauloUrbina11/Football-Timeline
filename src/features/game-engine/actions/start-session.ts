"use server";

import { createClient } from "@/lib/supabase/server";
import { createGameSession } from "@/features/game-engine/actions/create-game-session";
import type { EventCardData } from "@/features/game-engine/domain/types";

export interface StartSessionResult {
  sessionId: string;
  cards: EventCardData[];
}

interface PlayCardRow {
  event_id: string;
  title: string;
  display_date: string | null;
  image_url: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Crea una sesión de juego y devuelve las tarjetas ya mezcladas, sin `correct_order`.
 * `difficulty`/`total_events` se envían como placeholders: el trigger `set_session_fields_from_timeline`
 * (ver supabase/migrations/0005) los sobrescribe siempre con los valores reales del timeline.
 *
 * `dailyChallengeId` (opcional): si se indica, la sesión queda enlazada al reto diario
 * correspondiente (ver src/features/daily-challenge/actions/get-today-challenge.ts), lo que
 * habilita luego `submit_daily_result` y su chequeo de idempotencia.
 */
export async function startSession(timelineId: string, dailyChallengeId?: string): Promise<StartSessionResult> {
  const supabase = await createClient();

  const { data: cardsData, error: cardsError } = await supabase.rpc("get_timeline_play_cards", {
    p_timeline_id: timelineId,
  });

  if (cardsError) {
    throw new Error(`No se pudo cargar el timeline: ${cardsError.message}`);
  }

  const rows = (cardsData ?? []) as PlayCardRow[];
  if (rows.length === 0) {
    throw new Error("Este timeline no tiene eventos publicados todavía.");
  }

  const cards: EventCardData[] = rows.map((row) => ({
    id: row.event_id,
    title: row.title,
    displayDate: row.display_date,
    imageUrl: row.image_url,
    metadata: row.metadata ?? {},
  }));

  const sessionId = await createGameSession(timelineId, dailyChallengeId);

  return { sessionId, cards };
}
