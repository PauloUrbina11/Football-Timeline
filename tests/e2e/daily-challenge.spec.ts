import { expect, test } from "@playwright/test";
import { ensureTodayDailyChallenge, getCorrectEventOrderByTimelineId, reorderCardsTo } from "./helpers";

test("Reto diario: se resuelve, genera un resultado compartible, y jugarlo dos veces no cambia el resultado", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  const { timelineId } = await ensureTodayDailyChallenge();
  const correctOrder = await getCorrectEventOrderByTimelineId(timelineId);

  await page.goto("/daily");

  const cards = page.locator('[data-testid="event-card"]');
  await expect(cards).toHaveCount(correctOrder.length, { timeout: 15_000 });

  // Ninguna fecha absoluta visible en pantalla, sea cual sea el timeline elegido hoy.
  const boardText = await page.locator("main, body").innerText();
  expect(boardText).not.toMatch(/\b(19|20)\d{2}\b/);

  await reorderCardsTo(page, correctOrder);
  await page.getByRole("button", { name: "Comprobar" }).click();

  const dailyResult = page.locator('[data-testid="daily-result"]');
  await expect(dailyResult).toBeVisible({ timeout: 10_000 });

  const gridBefore = await page.locator('[aria-label^="Resultado:"]').getAttribute("aria-label");
  expect(gridBefore).toMatch(/🟩|⬜/);

  await page.getByRole("button", { name: "Compartir resultado" }).click();
  await expect(page.getByRole("button", { name: "¡Copiado! ✓" })).toBeVisible();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain("Football Timeline");
  expect(clipboardText).toContain("/s/");
  expect(clipboardText).toMatch(/⭐|☆/);

  const shareUrl = clipboardText.trim().split("\n").pop() ?? "";
  const sharePath = new URL(shareUrl).pathname;

  // Visita la página pública de resultado (navegador real: solo texto renderizado, sin ruido de scripts).
  await page.goto(sharePath);
  const sharePageText = await page.locator("main, body").innerText();
  expect(sharePageText).toContain("Reto diario");
  expect(sharePageText).not.toMatch(/\b(19|20)\d{2}\b/);

  const shareCode = sharePath.split("/").pop();
  const ogResponse = await page.request.get(`/api/og/${shareCode}`);
  expect(ogResponse.status()).toBe(200);
  expect(ogResponse.headers()["content-type"]).toContain("image/png");

  // Volver a /daily con la misma identidad (misma cookie de sesión): debe mostrar el resultado
  // guardado, no un tablero nuevo — es la garantía de "no se puede jugar el reto diario dos veces".
  await page.goto("/daily");
  await expect(page.locator('[data-testid="already-played-summary"]')).toBeVisible({ timeout: 10_000 });
  const gridAfter = await page.locator('[aria-label^="Resultado:"]').getAttribute("aria-label");
  expect(gridAfter).toBe(gridBefore);
  await expect(page.locator('[data-testid="event-card"]')).toHaveCount(0);
});
