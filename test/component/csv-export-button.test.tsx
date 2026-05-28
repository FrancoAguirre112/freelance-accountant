import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render";
import { CsvExportButton } from "@/components/csv-export-button";

afterEach(() => vi.restoreAllMocks());

describe("<CsvExportButton />", () => {
  it("builds a CSV blob and triggers a download on click", async () => {
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const getData = () => [
      { Nombre: "Doe, John", Monto: 100 },
      { Nombre: "Acme", Monto: 50 },
    ];

    const { user } = renderWithProviders(
      <CsvExportButton getData={getData} filename="movimientos" />,
    );
    await user.click(screen.getByRole("button"));

    expect(clickSpy).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    expect(text).toContain("Nombre,Monto");
    expect(text).toContain('"Doe, John",100');
  });

  it("does nothing when there is no data", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const { user } = renderWithProviders(
      <CsvExportButton getData={() => []} filename="empty" />,
    );
    await user.click(screen.getByRole("button"));
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
