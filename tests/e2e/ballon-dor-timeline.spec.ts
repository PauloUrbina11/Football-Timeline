import { expect, test } from "@playwright/test";

const TIMELINE_URL = "/play/ballon_dor/ballon-dor-2015-2023";

// Nota de alcance: el flujo completo (arrastrar hasta el orden correcto → puntuación real) ya está
// probado end-to-end para Career Timeline (tests/e2e/career-timeline.spec.ts) usando el mismo
// componente genérico (TimelineBoard), y la lógica de verificación/puntuación específica de este
// timeline de 8 eventos ya está probada directamente contra los RPCs reales en Supabase (ver
// notas de la Fase 2). Aquí solo se verifica lo que es específico de este timeline: la cantidad
// de tarjetas, que no haya espóilers de fecha, y que el drag & drop responda con una lista larga.
test("Ballon d'Or Timeline: 8 tarjetas, sin fechas visibles, y el drag & drop reordena la lista", async ({ page }) => {
  await page.goto(TIMELINE_URL);

  const cards = page.locator('[data-testid="event-card"]');
  await expect(cards).toHaveCount(8, { timeout: 15_000 });

  const boardText = await page.locator("main, body").innerText();
  for (const year of ["2015", "2016", "2017", "2018", "2019", "2021", "2022", "2023"]) {
    expect(boardText).not.toContain(year);
  }

  const orderBefore = await cards.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-event-id")));

  const first = cards.nth(0);
  const second = cards.nth(1);
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  if (!firstBox || !secondBox) throw new Error("No se pudo medir las tarjetas.");

  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2 + 12, { steps: 5 });
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height * 0.85, { steps: 12 });
  await page.mouse.up();

  const orderAfter = await cards.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-event-id")));
  expect(orderAfter).not.toEqual(orderBefore);
  expect(orderAfter.sort()).toEqual(orderBefore.sort());
});
