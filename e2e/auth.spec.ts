import { expect, test } from "@playwright/test";

test.describe("auth & middleware", () => {
  test("redirects /login to the dashboard for an authenticated session", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Fiscus" }),
    ).toBeVisible();
  });

  test("redirects /onboarding to the dashboard when a profile already exists", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL("/");
  });
});
