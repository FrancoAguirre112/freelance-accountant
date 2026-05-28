import { expect, test } from "@playwright/test";

test("theme toggle switches between dark and light", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fiscus" })).toBeVisible();

  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Cambiar tema" }).click();
  await expect(html).toHaveClass(/light/);
});
