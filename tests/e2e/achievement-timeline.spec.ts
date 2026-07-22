import { expect, test } from "@playwright/test";
import { getCorrectEventOrder, reorderCardsTo } from "./helpers";

const TIMELINE_URL = "/play/achievement/zinedine-zidane-achievements";

test("Achievement Timeline: grilla en forma de camino, sin fechas, se resuelve y puntúa", async ({ page }) => {
  await page.goto(TIMELINE_URL);

  const cards = page.locator('[data-testid="event-card"]');
  await expect(cards).toHaveCount(6, { timeout: 15_000 });

  // El cliente nunca debe ver el año de cada premio/logro: revelaría el orden correcto.
  const boardText = await page.locator("main, body").innerText();
  for (const year of ["1997", "1998", "2000", "2002"]) {
    expect(boardText).not.toContain(year);
  }

  // Primer intento: el orden mezclado por el servidor casi con certeza no es el correcto.
  await page.getByRole("button", { name: "Comprobar" }).click();
  await expect(page.locator('[data-testid="event-card"][data-state="incorrect"]').first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('[data-testid="result-summary"]')).toHaveCount(0);

  // Se reordena hasta el orden real arrastrando por la grilla-serpiente (mezcla ejes X e Y).
  const correctOrder = await getCorrectEventOrder("zinedine-zidane-achievements");
  await reorderCardsTo(page, correctOrder);
  await page.getByRole("button", { name: "Comprobar" }).click();

  const summary = page.locator('[data-testid="result-summary"]');
  await expect(summary).toBeVisible({ timeout: 10_000 });
  await expect(summary).toContainText("6/6 correcto");
  await expect(summary).toContainText("puntos");
});

test("Achievement Timeline en contexto táctil: la página carga y las tarjetas son interactivas", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium-touch", "Solo aplica al proyecto con hasTouch");

  await page.goto(TIMELINE_URL);
  const cards = page.locator('[data-testid="event-card"]');
  await expect(cards).toHaveCount(6, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Comprobar" })).toBeVisible();
});
