// Pure CSV helpers extracted from csv-export-button.tsx / csv-importer.tsx
// so the serialization and row-mapping logic is unit-testable.

export type CsvCell = string | number;

/**
 * Serializes an array of row objects to CSV text (no BOM).
 * Quotes any field containing a comma, double-quote or newline,
 * escaping embedded quotes by doubling them.
 */
export function serializeCsv(rows: Record<string, CsvCell>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = String(val ?? "");
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(","),
    ),
  ].join("\n");
}

export interface CSVRow {
  TipoDato: string;
  Nombre?: string;
  Vinculo?: string;
  Monto?: string;
  Fecha?: string;
  FechaImputada?: string;
  Categoria?: string;
  Concepto?: string;
  Estado?: string;
}

export interface ImportPayload {
  clients: { name: string }[];
  presupuestos: {
    name: string;
    clientName: string;
    totalAmount: number;
    type: string;
    status: string;
  }[];
  recurring: {
    name: string;
    clientName: string;
    amount: number;
    type: string;
  }[];
  transactions: {
    date: Date;
    imputedDate: Date;
    amount: number;
    category: string;
    description: string;
    targetName?: string;
  }[];
}

/**
 * Maps parsed CSV rows into the payload shape expected by
 * bulkSmartImportAction. Lines whose TipoDato starts with `#` are comments.
 */
export function parseImportRows(data: CSVRow[]): ImportPayload {
  const payload: ImportPayload = {
    clients: [],
    presupuestos: [],
    recurring: [],
    transactions: [],
  };

  const rows = data.filter(
    (row) => !row.TipoDato?.trimStart().startsWith("#"),
  );

  rows.forEach((row) => {
    const type = row.TipoDato ? row.TipoDato.toLowerCase().trim() : "";
    const name = row.Nombre ? row.Nombre.trim() : "";
    const link = row.Vinculo ? row.Vinculo.trim() : "";
    const amount = parseFloat(row.Monto || "0");

    switch (type) {
      case "cliente":
        if (name) payload.clients.push({ name });
        break;

      case "presupuesto":
        if (name && link) {
          payload.presupuestos.push({
            name,
            clientName: link,
            totalAmount: amount,
            type:
              (row.Estado || "ingreso").toLowerCase().trim() === "egreso"
                ? "egreso"
                : "ingreso",
            status: "activo",
          });
        }
        break;

      case "recurrente":
        if (name && link) {
          const recType = (row.Estado || "service").toLowerCase().trim();
          payload.recurring.push({
            name,
            clientName: link,
            amount,
            type: recType === "payment" ? "payment" : "service",
          });
        }
        break;

      case "movimiento":
        if (row.Fecha) {
          payload.transactions.push({
            date: new Date(row.Fecha + "T12:00:00Z"),
            imputedDate: row.FechaImputada
              ? new Date(row.FechaImputada + "T12:00:00Z")
              : new Date(row.Fecha + "T12:00:00Z"),
            amount,
            category: (row.Categoria || "other") as string,
            description: row.Concepto || "",
            targetName: name || undefined,
          });
        }
        break;
    }
  });

  return payload;
}

export function rowCountExcludingComments(data: CSVRow[]): number {
  return data.filter((row) => !row.TipoDato?.trimStart().startsWith("#")).length;
}
