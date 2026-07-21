import { expect, test } from "@playwright/test";
import { getCorrectEventOrder, reorderCardsTo } from "./helpers";

const TIMELINE_URL = "/play/tournament/mundial-catar-momentos-clave";

test("Tournament Timeline: 4 tarjetas, sin fechas visibles, se resuelve y puntúa", async ({ page }) => {
  await page.goto(TIMELINE_URL);

  const cards = page.locator('[data-testid="event-card"]');
  await expect(cards).toHaveCount(4, { timeout: 15_000 });

  const boardText = await page.locator("main, body").innerText();
  for (const year of ["2022"]) {
    expect(boardText).not.toContain(year);
  }

  await page.getByRole("button", { name: "Comprobar" }).click();
  await expect(page.locator('[data-testid="result-summary"]')).toHaveCount(0);

  const correctOrder = await getCorrectEventOrder("mundial-catar-momentos-clave");
  await reorderCardsTo(page, correctOrder);
  await page.getByRole("button", { name: "Comprobar" }).click();

  const summary = page.locator('[data-testid="result-summary"]');
  await expect(summary).toBeVisible({ timeout: 10_000 });
  await expect(summary).toContainText("4/4 correcto");
});
