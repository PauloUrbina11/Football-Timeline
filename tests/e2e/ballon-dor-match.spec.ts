import { expect, test } from "@playwright/test";
import { createTestAdminClient } from "./helpers";

const TIMELINE_URL = "/play/ballon_dor/ballon-dor-2004-2007";

test("Ballon d'Or Timeline (modo emparejar invertido): arrastra cada balón al jugador que lo ganó", async ({ page }) => {
  await page.goto(TIMELINE_URL);

  const items = page.locator('[data-testid="match-item"]');
  const slots = page.locator('[data-testid="match-slot"]');
  await expect(items).toHaveCount(4, { timeout: 15_000 });
  await expect(slots).toHaveCount(4);

  // Los años SÍ son visibles a propósito en los balones (decisión de diseño de este modo).
  const boardText = await page.locator("main, body").innerText();
  for (const year of ["2004", "2005", "2006", "2007"]) {
    expect(boardText).toContain(year);
  }

  // Los casilleros muestran el nombre del jugador, en orden alfabético (nunca cronológico:
  // eso revelaría quién ganó antes que quién, justo lo que este modo no debe espoilear).
  const slotLabels = (await slots.allInnerTexts()).map((text) => text.trim());
  expect(slotLabels.some((label) => label.includes("Shevchenko"))).toBe(true);
  expect(slotLabels.some((label) => label.includes("Cannavaro"))).toBe(true);
  expect(slotLabels.some((label) => label.includes("Kaká"))).toBe(true);
  expect(slotLabels.some((label) => label.includes("Ronaldinho"))).toBe(true);

  // "Comprobar" debe estar deshabilitado hasta colocar todos los elementos.
  await expect(page.getByRole("button", { name: "Comprobar" })).toBeDisabled();

  const admin = createTestAdminClient();
  const { data: timeline } = await admin.from("timelines").select("id").eq("slug", "ballon-dor-2004-2007").single();
  const { data: correctRows } = await admin
    .from("timeline_events")
    .select("event_id, correct_order")
    .eq("timeline_id", timeline!.id)
    .order("correct_order");
  const correctOrder = correctRows!.map((row) => row.event_id as string);

  // Coloca cada balón (identificado por su data-event-id) en el casillero que le corresponde.
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
  await expect(summary).toContainText("4/4 correcto");
});
