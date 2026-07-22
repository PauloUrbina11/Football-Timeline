import { expect, test } from "@playwright/test";

const TIMELINE_URL = "/play/transfer/neymar-psg-transfer-value";

test("Transfer Timeline (modo adivinar): entrada compacta (máx. 3 dígitos + unidad) y pistas de más alto/más bajo hasta acertar", async ({
  page,
}) => {
  await page.goto(TIMELINE_URL);

  const input = page.locator('[data-testid="guess-input"]');
  await expect(input).toBeVisible({ timeout: 15_000 });

  // El valor real (222.000.000 €) nunca debe aparecer en pantalla antes de acertarlo.
  const boardTextBefore = await page.locator("main, body").innerText();
  expect(boardTextBefore).not.toMatch(/222[.,]?000[.,]?000/);

  // No se puede escribir un 4to dígito: se queda en los primeros 3.
  await input.fill("");
  await input.pressSequentially("2223");
  await expect(input).toHaveValue("222");
  await input.fill("");

  // Intento demasiado bajo (1M) → banner y pista "más alto". La unidad "M" es la que viene por defecto.
  await input.fill("1");
  await page.getByRole("button", { name: "Adivinar" }).click();
  const banner = page.locator('[data-testid="guess-hint-banner"]');
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await expect(banner).toHaveAttribute("data-result", "higher");
  await expect(page.locator('[data-testid="guess-history-item"]').first()).toHaveAttribute("data-result", "higher");

  // Intento demasiado alto (500M) → pista "más bajo".
  await input.fill("500");
  await page.getByRole("button", { name: "Adivinar" }).click();
  await expect(banner).toHaveAttribute("data-result", "lower", { timeout: 10_000 });

  // Cambiar a la unidad "mil" y volver a "M" para el intento exacto (222M).
  await page.locator('[data-testid="unit-k"]').click();
  await page.locator('[data-testid="unit-M"]').click();
  await input.fill("222");
  await page.getByRole("button", { name: "Adivinar" }).click();

  const summary = page.locator('[data-testid="result-summary"]');
  await expect(summary).toBeVisible({ timeout: 10_000 });
  await expect(summary).toContainText("222.000.000");
  await expect(summary).toContainText("puntos");
});

test("Transfer Timeline (modo adivinar): la unidad 'mil' calcula el valor correctamente y rendirse revela la respuesta", async ({
  page,
}) => {
  await page.goto(TIMELINE_URL);

  const input = page.locator('[data-testid="guess-input"]');
  await expect(input).toBeVisible({ timeout: 15_000 });

  await page.locator('[data-testid="unit-k"]').click();
  await input.fill("235");
  await expect(page.locator("form")).toContainText("235.000");

  await page.getByRole("button", { name: "Rendirse" }).click();

  const summary = page.locator('[data-testid="result-summary"]');
  await expect(summary).toBeVisible({ timeout: 10_000 });
  await expect(summary).toContainText("222.000.000");
});
