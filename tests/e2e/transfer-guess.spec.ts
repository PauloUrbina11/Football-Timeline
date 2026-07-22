import { expect, test } from "@playwright/test";

const TIMELINE_URL = "/play/transfer/neymar-psg-transfer-value";

test("Transfer Timeline (modo adivinar): pistas de más alto/más bajo hasta acertar el valor real", async ({ page }) => {
  await page.goto(TIMELINE_URL);

  const input = page.locator('[data-testid="guess-input"]');
  await expect(input).toBeVisible({ timeout: 15_000 });

  // El valor real (222.000.000 €) nunca debe aparecer en pantalla antes de acertarlo.
  const boardTextBefore = await page.locator("main, body").innerText();
  expect(boardTextBefore).not.toMatch(/222[.,]?000[.,]?000/);

  // Intento demasiado bajo → pista "más alto".
  await input.fill("1000000");
  await page.getByRole("button", { name: "Adivinar" }).click();
  const firstEntry = page.locator('[data-testid="guess-history-item"]').first();
  await expect(firstEntry).toBeVisible({ timeout: 10_000 });
  await expect(firstEntry).toHaveAttribute("data-result", "higher");

  // Intento demasiado alto → pista "más bajo".
  await input.fill("500000000");
  await page.getByRole("button", { name: "Adivinar" }).click();
  await expect(page.locator('[data-testid="guess-history-item"]').first()).toHaveAttribute("data-result", "lower", {
    timeout: 10_000,
  });

  // Intento exacto → correcto, revela el valor real y puntúa.
  await input.fill("222000000");
  await page.getByRole("button", { name: "Adivinar" }).click();

  const summary = page.locator('[data-testid="result-summary"]');
  await expect(summary).toBeVisible({ timeout: 10_000 });
  await expect(summary).toContainText("222.000.000");
  await expect(summary).toContainText("puntos");
});

test("Transfer Timeline (modo adivinar): rendirse revela el valor real sin puntuar", async ({ page }) => {
  await page.goto(TIMELINE_URL);

  const input = page.locator('[data-testid="guess-input"]');
  await expect(input).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Rendirse" }).click();

  const summary = page.locator('[data-testid="result-summary"]');
  await expect(summary).toBeVisible({ timeout: 10_000 });
  await expect(summary).toContainText("222.000.000");
});
