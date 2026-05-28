import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { TabSearch } from "@/components/tab-search";
import { renderWithProviders } from "../helpers/render";

const prefixes = [
  { key: "e", label: "Entidad" },
  { key: "m", label: "Monto" },
];

describe("<TabSearch />", () => {
  it("renders the placeholder and forwards typed input", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <TabSearch
        value=""
        onChange={onChange}
        placeholder="Buscar movimientos..."
        prefixes={prefixes}
      />,
    );

    const input = screen.getByPlaceholderText("Buscar movimientos...");
    await user.type(input, "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("shows the prefix help popover listing each prefix", async () => {
    const { user } = renderWithProviders(
      <TabSearch value="" onChange={vi.fn()} prefixes={prefixes} />,
    );

    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("Prefijos de búsqueda")).toBeInTheDocument();
    expect(screen.getByText("e:texto")).toBeInTheDocument();
    expect(screen.getByText("m:texto")).toBeInTheDocument();
  });

  it("hides the prefix button when there are no prefixes", () => {
    renderWithProviders(
      <TabSearch value="" onChange={vi.fn()} prefixes={[]} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
