import { expect, test } from "@playwright/test";
import { getCorrectEventOrder, reorderCardsTo } from "./helpers";

const TIMELINE_URL = "/play/tournament/mundial-catar-momentos-clave";

test("Tournament Timeline: bandera vs bandera, sin texto ni fechas, se resuelve y puntúa", async ({ page }) => {
  await page.goto(TIMELINE_URL);

  const cards = page.locator('[data-testid="event-card"]');
  await expect(cards).toHaveCount(4, { timeout: 15_000 });

  // El enunciado (instrucción) puede nombrar el torneo y su año — eso no revela el orden de
  // ningún partido. Lo que nunca debe aparecer es texto/fecha DENTRO de las tarjetas.
  const cardsText = await cards.allInnerTexts();
  for (const cardText of cardsText) {
    expect(cardText).not.toMatch(/\b(19|20)\d{2}\b/);
    expect(cardText).not.toMatch(/vence a|elimina a/i);
    expect(cardText).toContain("vs");
  }

  const boardText = await page.locator("main, body").innerText();
  expect(boardText).toContain("Mundial de Catar 2022");

  const correctOrder = await getCorrectEventOrder("mundial-catar-momentos-clave");
  await reorderCardsTo(page, correctOrder);
  await page.getByRole("button", { name: "Comprobar" }).click();

  const summary = page.locator('[data-testid="result-summary"]');
  await expect(summary).toBeVisible({ timeout: 10_000 });
  await expect(summary).toContainText("4/4 correcto");
});
