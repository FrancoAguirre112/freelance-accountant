import { expect, test } from "@playwright/test";

test("the entities dialog tags collaborators and shows outstanding balance", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Entidades/ }).click();

  // The seeded collaborator (800 owed, 300 paid → 500 outstanding)
  const row = page.getByRole("row", { name: /Juan Programador/ });
  await expect(row).toBeVisible();
  await expect(row.getByText("Colaborador")).toBeVisible();
  await expect(row.getByText(/Adeudado:.*500/)).toBeVisible();
});
