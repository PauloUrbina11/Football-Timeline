import { expect, test } from "@playwright/test";
import { getCorrectEventOrder, reorderCardsTo } from "./helpers";

const TIMELINE_URL = "/play/club_coach/fc-barcelona-coaches";

test("Club Timeline: línea horizontal con avatares genéricos, sin fechas ni fotos reales, se resuelve y puntúa", async ({
  page,
}) => {
  await page.goto(TIMELINE_URL);

  const cards = page.locator('[data-testid="event-card"]');
  await expect(cards).toHaveCount(6, { timeout: 15_000 });

  // El cliente nunca debe ver el año de cada entrenador: revelaría el orden correcto.
  const boardText = await page.locator("main, body").innerText();
  for (const year of ["2003", "2008", "2012", "2014", "2017", "2021"]) {
    expect(boardText).not.toContain(year);
  }

  // Avatares genéricos (iniciales sobre color), nunca una foto real de una persona identificable.
  await expect(page.locator('[data-testid="event-card"] img')).toHaveCount(0);

  // Primer intento: el orden mezclado por el servidor casi con certeza no es el correcto.
  await page.getByRole("button", { name: "Comprobar" }).click();
  await expect(page.locator('[data-testid="event-card"][data-state="incorrect"]').first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('[data-testid="result-summary"]')).toHaveCount(0);

  // Se reordena hasta el orden real arrastrando en el eje horizontal (línea de tiempo en diagrama).
  const correctOrder = await getCorrectEventOrder("fc-barcelona-coaches");
  await reorderCardsTo(page, correctOrder, "x");
  await page.getByRole("button", { name: "Comprobar" }).click();

  const summary = page.locator('[data-testid="result-summary"]');
  await expect(summary).toBeVisible({ timeout: 10_000 });
  await expect(summary).toContainText("6/6 correcto");
  await expect(summary).toContainText("puntos");
});

test("Club Timeline en contexto táctil: la página carga y las tarjetas son interactivas", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium-touch", "Solo aplica al proyecto con hasTouch");

  await page.goto(TIMELINE_URL);
  const cards = page.locator('[data-testid="event-card"]');
  await expect(cards).toHaveCount(6, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Comprobar" })).toBeVisible();
});
