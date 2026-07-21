import { expect, test } from "@playwright/test";
import { getCorrectEventOrder, reorderCardsTo } from "./helpers";

const TIMELINE_URL = "/play/career/cristiano-ronaldo-career";

test("Career Timeline: no se muestran fechas, un intento incorrecto solo resalta lo que falla, y el correcto puntúa", async ({
  page,
}) => {
  await page.goto(TIMELINE_URL);

  const cards = page.locator('[data-testid="event-card"]');
  await expect(cards).toHaveCount(6, { timeout: 15_000 });

  // El cliente nunca debe ver el año/fecha de cada evento: revelaría el orden correcto.
  const boardText = await page.locator("main, body").innerText();
  for (const year of ["2002", "2003", "2009", "2018", "2021", "2023"]) {
    expect(boardText).not.toContain(year);
  }

  // Primer intento: el orden mezclado por el servidor casi con certeza no es el correcto.
  await page.getByRole("button", { name: "Comprobar" }).click();
  await expect(page.locator('[data-testid="event-card"][data-state="incorrect"]').first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('[data-testid="result-summary"]')).toHaveCount(0);

  // Se reordena hasta el orden real (solo el test lo conoce, vía service_role) y se comprueba de nuevo.
  const correctOrder = await getCorrectEventOrder("cristiano-ronaldo-career");
  await reorderCardsTo(page, correctOrder);
  await page.getByRole("button", { name: "Comprobar" }).click();

  const summary = page.locator('[data-testid="result-summary"]');
  await expect(summary).toBeVisible({ timeout: 10_000 });
  await expect(summary).toContainText("6/6 correcto");
  await expect(summary).toContainText("puntos");
});

test("Career Timeline en contexto táctil: la página carga y las tarjetas son interactivas", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium-touch", "Solo aplica al proyecto con hasTouch");

  await page.goto(TIMELINE_URL);
  const cards = page.locator('[data-testid="event-card"]');
  await expect(cards).toHaveCount(6, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Comprobar" })).toBeVisible();
});
