import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render";

vi.mock("next/navigation", async () =>
  (await import("../helpers/router-mock")).navigationMock,
);

import { ActiveFilters } from "@/components/active-filters";
import { push, resetRouterMock, setSearchParams } from "../helpers/router-mock";

const clients = [{ id: 1, name: "Mermoz" }] as never;
const presupuestos = [{ id: 9, name: "Web Mermoz" }] as never;

beforeEach(() => resetRouterMock());

describe("<ActiveFilters />", () => {
  it("renders nothing when there are no active filters", () => {
    setSearchParams("");
    renderWithProviders(
      <ActiveFilters clients={clients} presupuestos={presupuestos} />,
    );
    expect(screen.queryByText("Filtros activos:")).not.toBeInTheDocument();
  });

  it("renders readable chips for client/presupuesto/category", () => {
    setSearchParams({ clientId: "1", presupuestoId: "9", category: "recurring" });
    renderWithProviders(
      <ActiveFilters clients={clients} presupuestos={presupuestos} />,
    );
    expect(screen.getByText("Entidad: Mermoz")).toBeInTheDocument();
    expect(screen.getByText("Presupuesto: Web Mermoz")).toBeInTheDocument();
    expect(screen.getByText("Categoría: Recurrente")).toBeInTheDocument();
  });

  it("removes a single filter via its X button", async () => {
    setSearchParams({ clientId: "1", category: "other" });
    const { user } = renderWithProviders(
      <ActiveFilters clients={clients} presupuestos={presupuestos} />,
    );
    const chip = screen.getByText("Entidad: Mermoz").closest("span")!;
    await user.click(chip.querySelector("button")!);

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(url).not.toContain("clientId");
    expect(url).toContain("category=other");
  });

  it("clears every filter with 'Limpiar todo'", async () => {
    setSearchParams({ clientId: "1", presupuestoId: "9" });
    const { user } = renderWithProviders(
      <ActiveFilters clients={clients} presupuestos={presupuestos} />,
    );
    await user.click(screen.getByText("Limpiar todo"));
    const url = push.mock.calls[0][0] as string;
    expect(url).not.toContain("clientId");
    expect(url).not.toContain("presupuestoId");
  });
});
