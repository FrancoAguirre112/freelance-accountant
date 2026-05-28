import { expect, test } from "@playwright/test";

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Fiscus" })).toBeVisible();
  });

  test("renders the four primary tabs", async ({ page }) => {
    for (const name of [
      "Dashboard",
      "Movimientos",
      "Presupuestos",
      "Recurrentes",
    ]) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }
  });

  test("shows the seeded transaction under Movimientos", async ({ page }) => {
    await page.getByRole("tab", { name: "Movimientos" }).click();
    await expect(page.getByText("Pago Hito 1 E2E")).toBeVisible();
  });

  test("lists seeded presupuestos", async ({ page }) => {
    await page.getByRole("tab", { name: "Presupuestos" }).click();
    await expect(page.getByText("Web Mermoz")).toBeVisible();
    await expect(page.getByText("Licencia Anual")).toBeVisible();
  });

  test("lists the seeded recurring service", async ({ page }) => {
    await page.getByRole("tab", { name: "Recurrentes" }).click();
    await expect(page.getByText("Mantenimiento Web")).toBeVisible();
  });
});
