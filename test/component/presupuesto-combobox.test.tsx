import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render";
import { PresupuestoCombobox } from "@/components/presupuesto-combobox";

const presupuestos = [
  { id: 1, name: "Web Mermoz", type: "ingreso" },
  { id: 2, name: "Licencia", type: "egreso" },
];

describe("<PresupuestoCombobox />", () => {
  it("lists only presupuestos matching filterType", async () => {
    const { user } = renderWithProviders(
      <PresupuestoCombobox presupuestos={presupuestos} filterType="egreso" />,
    );
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("Licencia")).toBeInTheDocument();
    expect(screen.queryByText("Web Mermoz")).not.toBeInTheDocument();
  });

  it("selects a presupuesto and stores its id", async () => {
    const { container, user } = renderWithProviders(
      <PresupuestoCombobox presupuestos={presupuestos} name="presupuestoId" />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Web Mermoz"));

    const hidden = container.querySelector(
      'input[name="presupuestoId"]',
    ) as HTMLInputElement;
    expect(hidden.value).toBe("1");
  });

  it("resets to no value via 'Ninguno'", async () => {
    const { container, user } = renderWithProviders(
      <PresupuestoCombobox presupuestos={presupuestos} name="presupuestoId" />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Web Mermoz"));
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText(/Ninguno/));

    const hidden = container.querySelector(
      'input[name="presupuestoId"]',
    ) as HTMLInputElement;
    expect(hidden.value).toBe("");
  });
});
