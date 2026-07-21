"use server";

import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";
import type { Stars } from "@/features/game-engine/domain/scoring";

export interface SubmitDailyResultResult {
  shareCode: string;
  shareUrl: string;
  resultGrid: string;
  points: number;
  stars: Stars;
  alreadyPlayed: boolean;
}

interface SubmitDailyResultRow {
  share_code: string;
  result_grid: string;
  points: number;
  stars: Stars;
  already_played: boolean;
}

/** Persiste el resultado compartible del reto diario. Idempotente: ver índices únicos de 0004. */
export async function submitDailyResult(sessionId: string): Promise<SubmitDailyResultResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("submit_daily_result", { p_session_id: sessionId }).single();

  if (error || !data) {
    throw new Error(`No se pudo guardar el resultado del reto diario: ${error?.message ?? "sin respuesta"}`);
  }

  const row = data as SubmitDailyResultRow;
  const siteUrl = getPublicEnv().NEXT_PUBLIC_SITE_URL;

  return {
    shareCode: row.share_code,
    shareUrl: `${siteUrl}/s/${row.share_code}`,
    resultGrid: row.result_grid,
    points: row.points,
    stars: row.stars,
    alreadyPlayed: row.already_played,
  };
}
