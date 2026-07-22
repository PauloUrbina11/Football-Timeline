"use server";

import { createClient } from "@/lib/supabase/server";

export interface RandomBallonDorWindow {
  timelineId: string;
  slug: string;
}

interface RandomWindowRow {
  timeline_id: string;
  slug: string;
}

/**
 * Genera una ventana de 4 ediciones consecutivas del Balón de Oro, elegidas al azar entre todo el
 * historial real, vía `generate_random_ballon_dor_window` (security definer — filtra ventanas con
 * ganadores repetidos y crea el `timelines`/`timeline_events` correspondiente). Ver
 * supabase/migrations/0014_ballon_dor_random_window.sql.
 */
export async function generateRandomBallonDorWindow(): Promise<RandomBallonDorWindow> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("generate_random_ballon_dor_window").single();

  if (error || !data) {
    throw new Error(`No se pudo generar un nuevo reto de Balón de Oro: ${error?.message ?? "sin respuesta"}`);
  }

  const row = data as RandomWindowRow;
  return { timelineId: row.timeline_id, slug: row.slug };
}
