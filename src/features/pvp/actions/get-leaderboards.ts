"use server";

import { createClient } from "@/lib/supabase/server";

export interface WorldLeaderboardRow {
  userId: string;
  displayName: string;
  country: string | null;
  currentRating: number;
  peakRating: number;
}

export interface HistoricalLeaderboardRow {
  userId: string;
  displayName: string;
  rating: number;
}

interface WorldRow {
  user_id: string;
  display_name: string;
  country: string | null;
  current_rating: number;
  peak_rating: number;
}

interface HistoricalRow {
  user_id: string;
  display_name: string;
  rating: number;
}

/** Ranking mundial: pvp_ratings + profiles, sin duplicar datos (ver get_pvp_leaderboard_world, 0022). */
export async function getPvpWorldLeaderboard(limit = 50): Promise<WorldLeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_pvp_leaderboard_world", { p_limit: limit });
  if (error) {
    throw new Error(`No se pudo cargar el ranking mundial: ${error.message}`);
  }
  return ((data ?? []) as WorldRow[]).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    country: row.country,
    currentRating: row.current_rating,
    peakRating: row.peak_rating,
  }));
}

/** Ranking histórico: temporada vigente (en vivo) o una temporada cerrada (snapshot final). */
export async function getPvpHistoricalLeaderboard(seasonId?: string, limit = 50): Promise<HistoricalLeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_pvp_leaderboard_historical", {
    p_season_id: seasonId ?? null,
    p_limit: limit,
  });
  if (error) {
    throw new Error(`No se pudo cargar el ranking histórico: ${error.message}`);
  }
  return ((data ?? []) as HistoricalRow[]).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    rating: row.rating,
  }));
}
