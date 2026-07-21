"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrCreateAnonId } from "@/lib/anon-id";
import { getPublicEnv } from "@/lib/env";
import { todayChallengeDateISO } from "@/features/daily-challenge/domain/daily-selector";
import type { Stars } from "@/features/game-engine/domain/scoring";

interface EnsureDailyChallengeRow {
  challenge_id: string;
  timeline_id: string;
}

export interface TodayChallengeAlreadyPlayed {
  status: "already_played";
  challengeDateISO: string;
  shareCode: string;
  shareUrl: string;
  resultGrid: string;
  points: number;
  stars: Stars;
  timeMs: number;
  attempts: number;
}

export interface TodayChallengePending {
  status: "pending";
  challengeDateISO: string;
  challengeId: string;
  timelineId: string;
  timelineTitle: string;
}

export type TodayChallengeResult = TodayChallengeAlreadyPlayed | TodayChallengePending;

/**
 * Resuelve el reto diario de hoy (creándolo vía fallback determinista si nadie lo asignó todavía)
 * y comprueba si este jugador (o este invitado) ya lo jugó, para no dejarle cambiar su resultado.
 */
export async function getTodayChallenge(): Promise<TodayChallengeResult> {
  const supabase = await createClient();
  const challengeDateISO = todayChallengeDateISO();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const anonId = userId ? null : await getOrCreateAnonId();

  const { data: ensureData, error: ensureError } = await supabase
    .rpc("ensure_daily_challenge", { p_date: challengeDateISO })
    .single();

  if (ensureError || !ensureData) {
    throw new Error(`No se pudo resolver el reto diario: ${ensureError?.message ?? "sin respuesta"}`);
  }

  const { challenge_id: challengeId, timeline_id: timelineId } = ensureData as EnsureDailyChallengeRow;

  const existingQuery = supabase
    .from("daily_results")
    .select("share_code, result_grid, points, stars, time_ms, attempts")
    .eq("daily_challenge_id", challengeId);

  const { data: existing, error: existingError } = await (userId
    ? existingQuery.eq("user_id", userId)
    : existingQuery.eq("anon_id", anonId)
  ).maybeSingle();

  if (existingError) {
    throw new Error(`No se pudo comprobar el resultado del reto diario: ${existingError.message}`);
  }

  if (existing) {
    const shareCode = existing.share_code as string;
    return {
      status: "already_played",
      challengeDateISO,
      shareCode,
      shareUrl: `${getPublicEnv().NEXT_PUBLIC_SITE_URL}/s/${shareCode}`,
      resultGrid: existing.result_grid as string,
      points: existing.points as number,
      stars: existing.stars as Stars,
      timeMs: existing.time_ms as number,
      attempts: existing.attempts as number,
    };
  }

  const { data: timeline, error: timelineError } = await supabase
    .from("timelines")
    .select("id, title")
    .eq("id", timelineId)
    .single();

  if (timelineError || !timeline) {
    throw new Error(`No se pudo cargar el timeline del reto diario: ${timelineError?.message ?? "no encontrado"}`);
  }

  return {
    status: "pending",
    challengeDateISO,
    challengeId,
    timelineId: timeline.id as string,
    timelineTitle: timeline.title as string,
  };
}
