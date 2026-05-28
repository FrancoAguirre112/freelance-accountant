import { describe, expect, it } from "vitest";
import { act, renderHook, screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render";
import {
  TabFilters,
  useTabFilters,
  type FilterField,
} from "@/components/tab-filters";

describe("useTabFilters", () => {
  it("sets, overwrites and clears values", () => {
    const { result } = renderHook(() => useTabFilters());
    act(() => result.current.onChange("category", "recurring"));
    expect(result.current.values).toEqual({ category: "recurring" });

    act(() => result.current.onChange("category", "other"));
    expect(result.current.values).toEqual({ category: "other" });

    act(() => result.current.onClear());
    expect(result.current.values).toEqual({});
  });
});

const fields: FilterField[] = [
  { key: "onlyUnpaid", label: "Solo impagos", type: "switch" },
  {
    key: "category",
    label: "Categoría",
    type: "select",
    options: [{ value: "recurring", label: "Recurrente" }],
  },
];

describe("<TabFilters />", () => {
  it("toggles a switch field through onChange", async () => {
    let values: Record<string, string> = {};
    const onChange = (k: string, v: string) => {
      values = { ...values, [k]: v };
    };
    const { user } = renderWithProviders(
      <TabFilters
        fields={fields}
        values={values}
        onChange={onChange}
        onClear={() => {}}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("switch"));
    expect(values.onlyUnpaid).toBe("true");
  });

  it("shows an active-count badge and a working clear button", async () => {
    let cleared = false;
    const { user } = renderWithProviders(
      <TabFilters
        fields={fields}
        values={{ onlyUnpaid: "true" }}
        onChange={() => {}}
        onClear={() => {
          cleared = true;
        }}
      />,
    );
    // badge with count "1" on the trigger
    expect(screen.getByText("1")).toBeInTheDocument();

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Limpiar"));
    expect(cleared).toBe(true);
  });
});
