import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render";

const { bulkSmartImportAction } = vi.hoisted(() => ({
  bulkSmartImportAction: vi.fn(),
}));
vi.mock("@/app/actions", () => ({ bulkSmartImportAction }));

import { CSVImporter } from "@/components/csv-importer";
import { toast } from "sonner";

beforeEach(() => {
  bulkSmartImportAction.mockReset();
});

describe("<CSVImporter />", () => {
  it("opens the dialog from the trigger", async () => {
    const { user } = renderWithProviders(<CSVImporter />);
    await user.click(screen.getByRole("button", { name: /Importar CSV/ }));
    expect(
      await screen.findByText("Importación Masiva Inteligente"),
    ).toBeInTheDocument();
  });

  it("parses an uploaded CSV and calls the import action", async () => {
    bulkSmartImportAction.mockResolvedValue({ success: true });
    const { user } = renderWithProviders(<CSVImporter />);
    await user.click(screen.getByRole("button", { name: /Importar CSV/ }));

    const csv = [
      "TipoDato,Nombre,Vinculo,Monto,Fecha,FechaImputada,Categoria,Concepto,Estado",
      "cliente,Mermoz,,,,,,,",
      "presupuesto,Web,Mermoz,1500,,,,,ingreso",
      "movimiento,Web,,500,2026-03-01,2026-03-01,presupuesto,Hito 1,",
    ].join("\n");
    const file = new File([csv], "data.csv", { type: "text/csv" });

    const input = document.getElementById("csv-upload") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(bulkSmartImportAction).toHaveBeenCalledTimes(1));
    const payload = bulkSmartImportAction.mock.calls[0][0];
    expect(payload.clients).toEqual([{ name: "Mermoz" }]);
    expect(payload.presupuestos[0]).toMatchObject({
      name: "Web",
      clientName: "Mermoz",
      type: "ingreso",
    });
    expect(payload.transactions).toHaveLength(1);
    expect(toast.success).toHaveBeenCalled();
  });
});
