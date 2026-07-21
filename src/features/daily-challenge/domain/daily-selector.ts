/**
 * Índice determinista del timeline del día: "días desde la época Unix, módulo nº de timelines
 * elegibles". Misma fecha (UTC) -> mismo índice siempre, sin necesitar estado.
 *
 * Esta función es la especificación en TypeScript, testeada aquí; la que realmente se ejecuta en
 * producción es `ensure_daily_challenge()` en supabase/migrations/0008_daily_challenge_selector.sql,
 * que replica exactamente esta misma fórmula (debe mantenerse en sincronía si cambia).
 */
export function selectDailyTimelineIndex(challengeDateISO: string, eligibleCount: number): number {
  if (eligibleCount <= 0) {
    throw new Error("No hay timelines elegibles para el daily challenge.");
  }

  const epochDays = Math.floor(Date.parse(`${challengeDateISO}T00:00:00Z`) / 86_400_000);
  return ((epochDays % eligibleCount) + eligibleCount) % eligibleCount;
}

/** Fecha del reto de hoy en UTC, formato YYYY-MM-DD — todos los jugadores ven la misma. */
export function todayChallengeDateISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
