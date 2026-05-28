import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", async () =>
  (await import("../helpers/router-mock")).navigationMock,
);

import { TabSearch } from "@/components/tab-search";
import { ActiveFilters } from "@/components/active-filters";
import { setSearchParams } from "../helpers/router-mock";

describe("TabSearch snapshot", () => {
  it("renders the search field with prefix help", () => {
    const { container } = render(
      <TabSearch
        value="e:Mermoz"
        onChange={() => {}}
        placeholder="Buscar movimientos..."
        prefixes={[
          { key: "e", label: "Entidad" },
          { key: "m", label: "Monto" },
        ]}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("ActiveFilters snapshot", () => {
  it("renders readable filter chips", () => {
    setSearchParams({ clientId: "1", category: "recurring" });
    const { container } = render(
      <ActiveFilters
        clients={[{ id: 1, name: "Mermoz" }] as never}
        presupuestos={[] as never}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
