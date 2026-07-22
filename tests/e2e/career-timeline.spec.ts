import { expect, test } from "@playwright/test";
import { createTestAdminClient } from "./helpers";

const TIMELINE_URL = "/play/career/cristiano-ronaldo-career";

// Career Timeline se fusionó con la antigua Transfer Timeline (compartían el mismo tema: "los
// clubes de un jugador" — ver docs/architecture.md): ahora usa la mecánica "match, year-slots",
// igual que la tenía Transfer. El flujo de emparejar ya está cubierto en detalle por
// transfer-guess.spec.ts (el otro lado del mecanismo "match") y ballon-dor-match.spec.ts; aquí se
// verifica lo específico de este timeline real: 6 camisetas, 6 años, sin espóiler de club↔año.
test("Career Timeline (modo emparejar): arrastra cada camiseta al año en que fichó, sin espóiler", async ({ page }) => {
  await page.goto(TIMELINE_URL);

  const items = page.locator('[data-testid="match-item"]');
  const slots = page.locator('[data-testid="match-slot"]');
  await expect(items).toHaveCount(6, { timeout: 15_000 });
  await expect(slots).toHaveCount(6);

  // Los años SÍ son visibles a propósito en los casilleros (decisión de diseño de este modo).
  const boardText = await page.locator("main, body").innerText();
  for (const year of ["2002", "2003", "2009", "2018", "2021", "2023"]) {
    expect(boardText).toContain(year);
  }

  await expect(page.getByRole("button", { name: "Comprobar" })).toBeDisabled();

  const admin = createTestAdminClient();
  const { data: timeline } = await admin.from("timelines").select("id").eq("slug", "cristiano-ronaldo-career").single();
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
  await expect(summary).toContainText("6/6 correcto");
});

test("Career Timeline en contexto táctil: la página carga y los elementos son interactivos", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium-touch", "Solo aplica al proyecto con hasTouch");

  await page.goto(TIMELINE_URL);
  const items = page.locator('[data-testid="match-item"]');
  await expect(items).toHaveCount(6, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Comprobar" })).toBeVisible();
});
