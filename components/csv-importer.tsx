"use client";

import * as React from "react";
import Papa from "papaparse";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { bulkSmartImportAction } from "@/app/actions";
import { toast } from "sonner";

// Interfaz que coincide con las columnas de tu CSV
interface CSVRow {
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

export function CSVImporter() {
  const [loading, setLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  const handleDownloadTemplate = () => {
    const csvContent = [
      "TipoDato,Nombre,Vinculo,Monto,Fecha,FechaImputada,Categoria,Concepto,Estado",
      "cliente,Mermoz,,,,,,,",
      "proyecto,Web Mermoz,Mermoz,1500.00,,,,,en_desarrollo",
      "recurrente,Mantenimiento Mensual,Mermoz,50.00,,,,,",
      "movimiento,Web Mermoz,,500.00,2024-03-01,2024-03-01,project,Pago Hito 1,",
      "movimiento,,,100.00,2024-03-05,,other,Gasto vario,",
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_inteligente_dashboard.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // Preparamos los contenedores de datos limpios
        // Nota: Estos tipos coinciden con lo que espera bulkSmartImportAction
        const payload = {
          clients: [] as { name: string }[],
          projects: [] as {
            name: string;
            clientName: string;
            totalAmount: number;
            status: string;
          }[],
          recurring: [] as {
            name: string;
            clientName: string;
            amount: number;
            type: string;
          }[],
          transactions: [] as {
            date: Date;
            imputedDate: Date;
            amount: number;
            category: string;
            description: string;
            targetName?: string;
          }[],
        };

        results.data.forEach((row) => {
          // Normalización segura para evitar errores si la columna viene vacía
          const type = row.TipoDato ? row.TipoDato.toLowerCase().trim() : "";
          const name = row.Nombre ? row.Nombre.trim() : "";
          const link = row.Vinculo ? row.Vinculo.trim() : "";
          const amount = parseFloat(row.Monto || "0");

          switch (type) {
            case "cliente":
              if (name) payload.clients.push({ name });
              break;

            case "proyecto":
              if (name && link) {
                payload.projects.push({
                  name,
                  clientName: link,
                  totalAmount: amount,
                  status: row.Estado || "en_desarrollo",
                });
              }
              break;

            case "recurrente":
              if (name && link) {
                payload.recurring.push({
                  name,
                  clientName: link,
                  amount,
                  type: "recurring",
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
                  // Si hay un nombre en la fila de movimiento, lo usamos para vincular
                  targetName: name || undefined,
                });
              }
              break;
          }
        });

        // Enviamos todo al servidor para la resolución inteligente
        const res = await bulkSmartImportAction(payload);

        if (res.success) {
          toast.success("Importación Exitosa", {
            description: `Se procesaron ${results.data.length} filas y se vincularon automáticamente.`,
          });
          setIsOpen(false);
        } else {
          toast.error("Error en la importación", {
            description: "Verifica que el CSV tenga el formato correcto.",
          });
        }

        setLoading(false);
        // Limpiamos el input para permitir subir el mismo archivo de nuevo si es necesario
        e.target.value = "";
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Importación Masiva Inteligente</DialogTitle>
          <DialogDescription>
            Sube un CSV. El sistema resolverá y vinculará automáticamente
            Clientes, Proyectos y Pagos por nombre.
          </DialogDescription>
        </DialogHeader>

        <div className="gap-6 grid py-4">
          <div className="space-y-3 bg-muted/50 p-4 border rounded-md text-muted-foreground text-sm">
            <h4 className="flex items-center gap-2 font-semibold text-foreground">
              <FileSpreadsheet className="w-4 h-4" /> Formato Requerido
              (Nombres, no IDs):
            </h4>
            <ul className="space-y-1 pl-5 list-disc">
              <li>
                <strong>Proyectos:</strong> Columna &apos;Vinculo&apos; = Nombre
                del Cliente.
              </li>
              <li>
                <strong>Movimientos:</strong> Columna &apos;Nombre&apos; =
                Nombre del Proyecto/Servicio al que pertenece (Opcional).
              </li>
            </ul>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadTemplate}
              className="mt-2 w-full"
            >
              <Download className="mr-2 w-4 h-4" /> Descargar Plantilla Nueva
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv-upload" className="font-medium text-base">
              Seleccionar Archivo
            </Label>
            <Button
              variant="default"
              disabled={loading}
              className="relative w-full"
              onClick={() => document.getElementById("csv-upload")?.click()}
            >
              {loading ? (
                "Analizando y Vinculando..."
              ) : (
                <>
                  <Upload className="mr-2 w-4 h-4" /> Subir Archivo
                </>
              )}
              <input
                id="csv-upload"
                type="file"
                className="hidden"
                onChange={handleFile}
                accept=".csv"
                disabled={loading}
              />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
