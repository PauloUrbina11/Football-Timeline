import { expect, test, type Page } from "@playwright/test";
import { createTestAdminClient } from "./helpers";

/** Resuelve el tablero ya cargado en `page` (arrastra cada balón al casillero que le corresponde). */
async function solveBallonDorTimeline(page: Page, slug: string, expectedCount: number) {
  const items = page.locator('[data-testid="match-item"]');
  const slots = page.locator('[data-testid="match-slot"]');
  await expect(items).toHaveCount(expectedCount, { timeout: 15_000 });
  await expect(slots).toHaveCount(expectedCount);
  await expect(page.getByRole("button", { name: "Comprobar" })).toBeDisabled();

  const admin = createTestAdminClient();
  const { data: timeline } = await admin.from("timelines").select("id").eq("slug", slug).single();
  const { data: correctRows } = await admin
    .from("timeline_events")
    .select("event_id, correct_order")
    .eq("timeline_id", timeline!.id)
    .order("correct_order");
  const correctOrder = correctRows!.map((row) => row.event_id as string);

  for (let slotIndex = 1; slotIndex <= correctOrder.length; slotIndex++) {
    const eventId = correctOrder[slotIndex - 1];
    const item = page.locator(`[data-testid="match-item"][data-event-id="${eventId}"]`);
    const slot = page.locator(`[data-testid="match-slot"][data-slot-index="${slotIndex}"]`);

    const itemBox = await item.boundingBox();
    const slotBox = await slot.boundingBox();
    if (!itemBox || !slotBox) throw new Error("No se pudo medir la posición.");

    await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(itemBox.x + itemBox.width / 2 + 5, itemBox.y + itemBox.height / 2 + 5, { steps: 5 });
    await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(100);
  }

  await expect(items).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Comprobar" })).toBeEnabled();
  await page.getByRole("button", { name: "Comprobar" }).click();

  const summary = page.locator('[data-testid="result-summary"]');
  await expect(summary).toBeVisible({ timeout: 10_000 });
  await expect(summary).toContainText(`${expectedCount}/${expectedCount} correcto`);
}

test("Ballon d'Or Timeline: genera una ventana aleatoria de 4 ediciones consecutivas y se resuelve", async ({ page }) => {
  await page.goto("/play/ballon_dor");
  await page.waitForURL(/\/play\/ballon_dor\/.+/, { timeout: 15_000 });
  const slug = new URL(page.url()).pathname.split("/").pop()!;

  // Ya no se descartan ventanas con un ganador repetido (ver 0016_ballon_dor_allow_repeat_winners.sql):
  // los 4 TEXTOS de casillero deben ser únicos igual, gracias al sufijo de ordinal de carrera
  // ("Messi (5)") cuando un jugador se repite — nunca por ausencia de repetidos.
  const slots = page.locator('[data-testid="match-slot"]');
  await expect(slots).toHaveCount(4, { timeout: 15_000 });
  const slotLabels = (await slots.allInnerTexts()).map((text) => text.trim());
  expect(new Set(slotLabels).size).toBe(4);

  // Los años SÍ son visibles a propósito en los balones (decisión de diseño de este modo).
  const boardText = await page.locator("main, body").innerText();
  expect(boardText).toMatch(/\b(19[5-9]\d|20[0-2]\d)\b/);

  await solveBallonDorTimeline(page, slug, 4);
});

test("Ballon d'Or Timeline: dos visitas seguidas generan timelines distintos (no una lista fija)", async ({ page }) => {
  await page.goto("/play/ballon_dor");
  await page.waitForURL(/\/play\/ballon_dor\/.+/, { timeout: 15_000 });
  const firstSlug = new URL(page.url()).pathname.split("/").pop();

  await page.goto("/play/ballon_dor");
  await page.waitForURL(/\/play\/ballon_dor\/.+/, { timeout: 15_000 });
  const secondSlug = new URL(page.url()).pathname.split("/").pop();

  expect(firstSlug).not.toBe(secondSlug);
});

test("Ballon d'Or Timeline: un jugador repetido en la ventana se etiqueta con su ordinal de carrera real", async () => {
  const admin = createTestAdminClient();

  // Construye directamente (sin pasar por la generación aleatoria) una ventana con Messi repetido
  // dos veces, para probar get_ballon_dor_match_slots de forma determinista.
  const { data: messi } = await admin.from("subjects").select("id").eq("slug", "lionel-messi").single();
  const { data: messiEvents } = await admin
    .from("events")
    .select("id, metadata")
    .eq("subject_id", messi!.id)
    .not("metadata->ballon_dor_edition", "is", null)
    .order("metadata->ballon_dor_edition")
    .limit(2);
  const { data: otherEvents } = await admin
    .from("events")
    .select("id, subject_id")
    .not("metadata->ballon_dor_edition", "is", null)
    .neq("subject_id", messi!.id)
    .limit(2);

  const { data: timeline } = await admin
    .from("timelines")
    .insert({
      mode_id: "ballon_dor",
      difficulty: "easy",
      title: "Test: Messi repetido",
      slug: `test-messi-repetido-${Date.now()}`,
      status: "draft",
      is_daily_eligible: false,
    })
    .select("id")
    .single();

  await admin.from("timeline_events").insert([
    { timeline_id: timeline!.id, event_id: otherEvents![0].id, correct_order: 1 },
    { timeline_id: timeline!.id, event_id: otherEvents![1].id, correct_order: 2 },
    { timeline_id: timeline!.id, event_id: messiEvents![0].id, correct_order: 3 },
    { timeline_id: timeline!.id, event_id: messiEvents![1].id, correct_order: 4 },
  ]);
  await admin.from("timelines").update({ status: "published", published_at: new Date().toISOString() }).eq("id", timeline!.id);

  const { data: slots, error } = await admin.rpc("get_ballon_dor_match_slots", { p_timeline_id: timeline!.id });
  expect(error).toBeNull();

  const messiSlots = slots!.filter((s: { label: string }) => s.label.startsWith("Lionel Messi"));
  expect(messiSlots).toHaveLength(2);
  expect(messiSlots.every((s: { label: string }) => /Lionel Messi \(\d\)/.test(s.label))).toBe(true);
  // Distintos entre sí: el sufijo evita la ambigüedad de dos casilleros idénticos.
  expect(messiSlots[0].label).not.toBe(messiSlots[1].label);

  await admin.from("timelines").delete().eq("id", timeline!.id);
});
