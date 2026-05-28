import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render";

const { createClientAction } = vi.hoisted(() => ({
  createClientAction: vi.fn(),
}));
vi.mock("@/app/actions", () => ({ createClientAction }));

import { ClientCombobox } from "@/components/client-combobox";
import { toast } from "sonner";

const clients = [
  { id: 1, name: "Mermoz" },
  { id: 2, name: "Proveedor Cloud" },
];

beforeEach(() => {
  createClientAction.mockReset();
});

describe("<ClientCombobox />", () => {
  it("selects an existing client and writes the id to the hidden input", async () => {
    const { container, user } = renderWithProviders(
      <ClientCombobox clients={clients} name="clientId" />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Mermoz"));

    const hidden = container.querySelector(
      'input[name="clientId"]',
    ) as HTMLInputElement;
    expect(hidden.value).toBe("1");
    expect(screen.getByRole("combobox")).toHaveTextContent("Mermoz");
  });

  it("creates a new client when typing a non-existent name", async () => {
    createClientAction.mockResolvedValue({ success: true, id: 99 });

    const { user } = renderWithProviders(
      <ClientCombobox clients={clients} name="clientId" />,
    );

    await user.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText("Buscar entidad...");
    await user.type(input, "Nueva SA");

    const listbox = screen.getByRole("listbox");
    await user.click(within(listbox).getByText(/Crear "Nueva SA"/));

    expect(createClientAction).toHaveBeenCalledWith({
      name: "Nueva SA",
      status: "active",
    });
    expect(toast.success).toHaveBeenCalledWith('Entidad "Nueva SA" creada');
  });

  it("does not offer to create when an exact match exists", async () => {
    const { user } = renderWithProviders(
      <ClientCombobox clients={clients} name="clientId" />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.type(
      await screen.findByPlaceholderText("Buscar entidad..."),
      "Mermoz",
    );
    expect(screen.queryByText(/^Crear/)).not.toBeInTheDocument();
  });
});
