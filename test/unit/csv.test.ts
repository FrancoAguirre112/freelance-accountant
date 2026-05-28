import { describe, expect, it } from "vitest";
import {
  parseImportRows,
  rowCountExcludingComments,
  serializeCsv,
  type CSVRow,
} from "@/lib/csv";

describe("serializeCsv", () => {
  it("returns an empty string for no rows", () => {
    expect(serializeCsv([])).toBe("");
  });

  it("emits a header row from the first object's keys", () => {
    const csv = serializeCsv([{ a: 1, b: "x" }]);
    expect(csv).toBe("a,b\n1,x");
  });

  it("quotes fields containing commas, quotes or newlines", () => {
    const csv = serializeCsv([
      { name: "Doe, John", note: 'say "hi"', extra: "line1\nline2" },
    ]);
    expect(csv).toBe(
      'name,note,extra\n"Doe, John","say ""hi""","line1\nline2"',
    );
  });

  it("renders null/undefined cells as empty strings", () => {
    const csv = serializeCsv([
      { a: "x", b: undefined as unknown as string },
    ]);
    expect(csv).toBe("a,b\nx,");
  });
});

describe("rowCountExcludingComments", () => {
  it("ignores rows whose TipoDato starts with #", () => {
    const rows: CSVRow[] = [
      { TipoDato: "# comment" },
      { TipoDato: "cliente", Nombre: "A" },
      { TipoDato: "  # indented comment" },
      { TipoDato: "movimiento", Fecha: "2026-01-01" },
    ];
    expect(rowCountExcludingComments(rows)).toBe(2);
  });
});

describe("parseImportRows", () => {
  it("maps clients, presupuestos, recurring and movimientos", () => {
    const rows: CSVRow[] = [
      { TipoDato: "# header comment" },
      { TipoDato: "cliente", Nombre: "Mermoz" },
      { TipoDato: "cliente", Nombre: "  " }, // skipped: no name
      {
        TipoDato: "presupuesto",
        Nombre: "Web",
        Vinculo: "Mermoz",
        Monto: "1500.50",
        Estado: "EGRESO",
      },
      {
        TipoDato: "presupuesto",
        Nombre: "Orphan",
        Monto: "100",
      }, // skipped: no Vinculo
      {
        TipoDato: "recurrente",
        Nombre: "Hosting",
        Vinculo: "Mermoz",
        Monto: "15",
        Estado: "payment",
      },
      {
        TipoDato: "movimiento",
        Nombre: "Web",
        Monto: "500",
        Fecha: "2026-03-01",
        Categoria: "presupuesto",
        Concepto: "Hito 1",
      },
      {
        TipoDato: "movimiento",
        Monto: "100",
        Categoria: "other",
      }, // skipped: no Fecha
    ];

    const p = parseImportRows(rows);

    expect(p.clients).toEqual([{ name: "Mermoz" }]);
    expect(p.presupuestos).toEqual([
      {
        name: "Web",
        clientName: "Mermoz",
        totalAmount: 1500.5,
        type: "egreso",
        status: "activo",
      },
    ]);
    expect(p.recurring).toEqual([
      { name: "Hosting", clientName: "Mermoz", amount: 15, type: "payment" },
    ]);
    expect(p.transactions).toHaveLength(1);
    expect(p.transactions[0]).toMatchObject({
      amount: 500,
      category: "presupuesto",
      description: "Hito 1",
      targetName: "Web",
    });
    expect(p.transactions[0].date.toISOString()).toBe("2026-03-01T12:00:00.000Z");
  });

  it("defaults presupuesto type to ingreso and recurring to service", () => {
    const p = parseImportRows([
      { TipoDato: "presupuesto", Nombre: "P", Vinculo: "C", Monto: "10" },
      { TipoDato: "recurrente", Nombre: "R", Vinculo: "C", Monto: "5" },
    ]);
    expect(p.presupuestos[0].type).toBe("ingreso");
    expect(p.recurring[0].type).toBe("service");
  });

  it("falls back imputedDate to Fecha when FechaImputada is absent", () => {
    const p = parseImportRows([
      { TipoDato: "movimiento", Monto: "1", Fecha: "2026-04-10" },
    ]);
    expect(p.transactions[0].imputedDate.toISOString()).toBe(
      "2026-04-10T12:00:00.000Z",
    );
  });

  it("parses an explicit FechaImputada distinct from Fecha", () => {
    const p = parseImportRows([
      {
        TipoDato: "movimiento",
        Monto: "1",
        Fecha: "2026-04-10",
        FechaImputada: "2026-05-01",
      },
    ]);
    expect(p.transactions[0].date.toISOString()).toBe("2026-04-10T12:00:00.000Z");
    expect(p.transactions[0].imputedDate.toISOString()).toBe(
      "2026-05-01T12:00:00.000Z",
    );
  });

  it("defaults a missing/invalid Monto to 0", () => {
    const p = parseImportRows([
      { TipoDato: "presupuesto", Nombre: "P", Vinculo: "C" },
    ]);
    expect(p.presupuestos[0].totalAmount).toBe(0);
  });
});
