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

  // Con solo 4 tarjetas (4! = 24 permutaciones) NO se comprueba aquí "el orden aleatorio inicial
  // falla casi seguro": ~4% de las veces el shuffle ya sale correcto por pura casualidad, lo que
  // volvía este test intermitente sin ser un bug real. Ese comportamiento (resaltar solo lo
  // incorrecto) ya está cubierto por career-timeline.spec.ts con 6 tarjetas (6! ≈ 0.14% de colisión).
  const correctOrder = await getCorrectEventOrder("mundial-catar-momentos-clave");
  await reorderCardsTo(page, correctOrder);
  await page.getByRole("button", { name: "Comprobar" }).click();

  const summary = page.locator('[data-testid="result-summary"]');
  await expect(summary).toBeVisible({ timeout: 10_000 });
  await expect(summary).toContainText("4/4 correcto");
});
