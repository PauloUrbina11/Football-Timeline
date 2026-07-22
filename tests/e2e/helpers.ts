import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente admin (service_role) exclusivo para los tests: lee el orden correcto para poder
 * dirigir el drag & drop de forma determinista. Un jugador real nunca tiene esta información
 * (ver policy `timeline_events_admin_all` en supabase/migrations/0002_rls_policies.sql).
 */
export function createTestAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno de test.");
  }
  return createClient(url, serviceRoleKey);
}

export async function getCorrectEventOrderByTimelineId(timelineId: string): Promise<string[]> {
  const admin = createTestAdminClient();
  const { data: rows, error } = await admin
    .from("timeline_events")
    .select("event_id, correct_order")
    .eq("timeline_id", timelineId)
    .order("correct_order");
  if (error || !rows) {
    throw new Error(`No se pudo leer timeline_events: ${error?.message}`);
  }
  return rows.map((row) => row.event_id as string);
}

export async function getCorrectEventOrder(timelineSlug: string): Promise<string[]> {
  const admin = createTestAdminClient();
  const { data: timeline, error: timelineError } = await admin
    .from("timelines")
    .select("id")
    .eq("slug", timelineSlug)
    .single();
  if (timelineError || !timeline) {
    throw new Error(`No se encontró el timeline "${timelineSlug}": ${timelineError?.message}`);
  }

  return getCorrectEventOrderByTimelineId(timeline.id as string);
}

/** Resuelve (o crea, con el mismo fallback determinista que la app) el daily challenge de hoy. */
export async function ensureTodayDailyChallenge(): Promise<{ challengeId: string; timelineId: string }> {
  const admin = createTestAdminClient();
  const { data, error } = await admin.rpc("ensure_daily_challenge").single();
  if (error || !data) {
    throw new Error(`No se pudo resolver el daily challenge de hoy: ${error?.message ?? "sin respuesta"}`);
  }
  const row = data as { challenge_id: string; timeline_id: string };
  return { challengeId: row.challenge_id, timelineId: row.timeline_id };
}

async function readCurrentOrder(page: Page): Promise<string[]> {
  return page.locator('[data-testid="event-card"]').evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-event-id") as string));
}

/**
 * El eje de movimiento se detecta a partir de la geometría real (no se asume un layout fijo):
 * en una lista vertical siempre es "y", en una fila horizontal siempre es "x", y en una grilla tipo
 * serpiente (Achievement Timeline) alterna según el par de tarjetas — dentro de una fila es "x", al
 * saltar de una fila a la siguiente es "y". El sesgo hacia el borde del destino en la dirección del
 * movimiento (no el centro exacto) hace falta porque dnd-kit decide "antes/después" del elemento
 * destino según de qué lado llega el puntero, y el centro es ambiguo entre ambos sentidos.
 */
async function dragCard(page: Page, fromIndex: number, toIndex: number) {
  const cards = page.locator('[data-testid="event-card"]');
  // El destino puede estar fuera del viewport visible (scroll de página, o una fila más abajo en una
  // grilla larga); boundingBox() devuelve su posición real de layout igual, así que arrastrar hacia
  // esas coordenadas sin desplazar antes apuntaría "fuera de pantalla" y el drag nunca conectaría.
  await cards.nth(toIndex).scrollIntoViewIfNeeded();
  const fromBox = await cards.nth(fromIndex).boundingBox();
  const toBox = await cards.nth(toIndex).boundingBox();
  if (!fromBox || !toBox) throw new Error("No se pudo medir la posición de las tarjetas a arrastrar.");

  const startX = fromBox.x + fromBox.width / 2;
  const startY = fromBox.y + fromBox.height / 2;
  const dx = toBox.x - fromBox.x;
  const dy = toBox.y - fromBox.y;
  const axis: "x" | "y" = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
  const movingForward = axis === "x" ? dx > 0 : dy > 0;
  const endX =
    axis === "x" ? (movingForward ? toBox.x + toBox.width * 0.85 : toBox.x + toBox.width * 0.15) : toBox.x + toBox.width / 2;
  const endY =
    axis === "y" ? (movingForward ? toBox.y + toBox.height * 0.85 : toBox.y + toBox.height * 0.15) : toBox.y + toBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Supera el `activationConstraint.distance` del PointerSensor antes de moverse al destino.
  const nudge = movingForward ? 12 : -12;
  await page.mouse.move(startX + (axis === "x" ? nudge : 0), startY + (axis === "y" ? nudge : 0), { steps: 5 });
  await page.mouse.move(endX, endY, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

/**
 * Reordena las tarjetas visibles hasta que coincidan exactamente con `targetOrder`.
 * Selection sort, pero cada reubicación se hace de a UNA posición adyacente por vez (nunca un
 * salto largo): durante un drag de larga distancia, dnd-kit va reubicando en vivo las tarjetas
 * intermedias, así que el punto de destino calculado antes de soltar el mouse queda desactualizado.
 * Los movimientos de una sola posición no tienen ese problema.
 */
export async function reorderCardsTo(page: Page, targetOrder: string[]): Promise<void> {
  for (let position = 0; position < targetOrder.length; position++) {
    let currentOrder = await readCurrentOrder(page);
    let currentIndex = currentOrder.indexOf(targetOrder[position]);
    if (currentIndex === -1) {
      throw new Error(`No se encontró la tarjeta ${targetOrder[position]} en el tablero.`);
    }

    // Invariante del selection sort: las posiciones [0, position) ya están fijadas,
    // así que el elemento buscado nunca puede estar antes de `position`; solo hace falta subirlo.
    while (currentIndex > position) {
      await dragCard(page, currentIndex, currentIndex - 1);
      currentIndex -= 1;
      currentOrder = await readCurrentOrder(page);
      const actualIndex = currentOrder.indexOf(targetOrder[position]);
      if (actualIndex !== currentIndex) {
        currentIndex = actualIndex;
      }
    }
  }

  const finalOrder = await readCurrentOrder(page);
  if (finalOrder.join(",") !== targetOrder.join(",")) {
    throw new Error(
      `El tablero no quedó en el orden esperado tras el drag & drop.\nEsperado: ${targetOrder.join(",")}\nObtenido: ${finalOrder.join(",")}`,
    );
  }
}
