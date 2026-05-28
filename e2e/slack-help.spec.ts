import { expect, test } from "@playwright/test";

test("the Slack webhook help page renders and links back to the dashboard", async ({
  page,
}) => {
  await page.goto("/help/slack-webhook");

  await expect(
    page.getByRole("heading", { name: "Configurar recordatorios en Slack" }),
  ).toBeVisible();
  await expect(page.getByText("Crear una app de Slack")).toBeVisible();
  await expect(page.getByText("Pegarla en Fiscus")).toBeVisible();

  await page.getByRole("link", { name: /Volver al dashboard/ }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Fiscus" })).toBeVisible();
});
