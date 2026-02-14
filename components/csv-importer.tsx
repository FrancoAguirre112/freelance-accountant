"use client";

import * as React from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { bulkSmartImportAction } from "@/app/actions";
import { toast } from "sonner";
import { type InferInsertModel } from "drizzle-orm";
import {
  clients,
  projects,
  transactions,
  recurringServices,
} from "@/db/schema";

// 1. Tipos de inserción de Drizzle
type NewClient = InferInsertModel<typeof clients>;
type NewProject = InferInsertModel<typeof projects>;
type NewTransaction = InferInsertModel<typeof transactions>;
type NewRecurring = InferInsertModel<typeof recurringServices>;
type TransactionCategory = "project" | "salary" | "maintenance" | "other";

// 2. Estructura del acumulador de importación
interface ImportData {
  clients: NewClient[];
  projects: NewProject[];
  transactions: NewTransaction[];
  recurring: NewRecurring[];
}

interface SmartCSVRow {
  TipoDato: "movimiento" | "proyecto" | "cliente" | "recurrente";
  Nombre?: string;
  ClienteId?: string;
  Monto?: string;
  Fecha?: string;
  FechaImputada?: string;
  Categoria?: string;
  Concepto?: string;
}

export function CSVImporter() {
  const [loading, setLoading] = React.useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    Papa.parse<SmartCSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // Inicialización con el tipo ImportData
        const importData: ImportData = {
          clients: [],
          projects: [],
          transactions: [],
          recurring: [],
        };

        results.data.forEach((row) => {
          switch (row.TipoDato) {
            case "cliente":
              if (row.Nombre) {
                importData.clients.push({ name: row.Nombre, status: "active" });
              }
              break;
            case "proyecto":
              if (row.Nombre && row.ClienteId) {
                importData.projects.push({
                  name: row.Nombre,
                  clientId: Number(row.ClienteId),
                  totalAmount: parseFloat(row.Monto || "0"),
                  status: "en_desarrollo",
                });
              }
              break;
            case "movimiento":
              if (row.Fecha) {
                importData.transactions.push({
                  date: new Date(row.Fecha),
                  imputedDate: row.FechaImputada
                    ? new Date(row.FechaImputada)
                    : new Date(row.Fecha),
                  amount: parseFloat(row.Monto || "0"),
                  category: row.Categoria as TransactionCategory, // Casting seguro
                  description: row.Concepto || "",
                  status: "paid",
                });
              }
              break;
            case "recurrente":
              if (row.Nombre && row.ClienteId && row.Categoria) {
                importData.recurring.push({
                  name: row.Nombre,
                  clientId: Number(row.ClienteId),
                  amount: parseFloat(row.Monto || "0"),
                  type: row.Categoria as "maintenance" | "salary",
                });
              }
              break;
          }
        });

        const res = await bulkSmartImportAction(importData);
        if (res.success) {
          toast.success("Importación inteligente completada", {
            description: "Todos los datos han sido procesados y guardados.",
          });
        } else {
          toast.error("Error en la importación masiva");
        }
        setLoading(false);
      },
    });
  };

  return (
    <div className="flex gap-2">
      <input
        type="file"
        id="smart-csv"
        className="hidden"
        onChange={handleFile}
        accept=".csv"
      />
      <Button
        variant="outline"
        onClick={() => document.getElementById("smart-csv")?.click()}
        disabled={loading}
      >
        {loading ? "Procesando..." : "Subir CSV Inteligente"}
      </Button>
    </div>
  );
}
