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
      "# ============================================================",
      "# PLANTILLA DE IMPORTACIÓN — Fiscus Dashboard",
      "# ============================================================",
      "#",
      "# INSTRUCCIONES PARA IA / USUARIOS:",
      "# Este archivo CSV permite importar datos masivamente al dashboard.",
      "# Las líneas que comienzan con # son comentarios y se ignoran.",
      "# El sistema vincula entidades por NOMBRE (no por ID).",
      "#",
      "# COLUMNAS:",
      "#   TipoDato      — Tipo de fila: cliente | presupuesto | recurrente | movimiento",
      "#   Nombre        — Nombre del elemento (obligatorio excepto en algunos movimientos)",
      "#   Vinculo       — Nombre de la Entidad asociada (para presupuesto/recurrente)",
      "#   Monto         — Valor numérico en USD (ej: 1500.00)",
      "#   Fecha         — Fecha real del movimiento (YYYY-MM-DD). Solo para movimientos",
      "#   FechaImputada — Fecha a la que se imputa el movimiento (YYYY-MM-DD). Solo para movimientos",
      "#   Categoria     — Categoría del movimiento: presupuesto | recurring | other",
      "#   Concepto      — Descripción o concepto del movimiento",
      "#   Estado        — Estado o subtipo según el TipoDato (ver detalle abajo)",
      "#",
      "# ============================================================",
      "# DETALLE POR TIPO DE DATO:",
      "# ============================================================",
      "#",
      "# 1. CLIENTE (Entidad)",
      "#    Columnas usadas: Nombre",
      "#    Ejemplo: cliente,Mermoz,,,,,,,",
      "#    Nota: Se crea si no existe. Si ya existe se reutiliza.",
      "#",
      "# 2. PRESUPUESTO",
      "#    Columnas usadas: Nombre, Vinculo (entidad), Monto, Estado",
      "#    Estado: ingreso | egreso (default: ingreso)",
      "#    Ejemplo ingreso: presupuesto,Web Mermoz,Mermoz,1500.00,,,,,ingreso",
      "#    Ejemplo egreso:  presupuesto,Licencia Anual,Proveedor X,120.00,,,,,egreso",
      "#    Nota: Vinculo debe ser el nombre exacto de una entidad (existente o definida arriba).",
      "#",
      "# 3. RECURRENTE (Operación Recurrente)",
      "#    Columnas usadas: Nombre, Vinculo (entidad), Monto, Estado",
      "#    Estado: service | payment (default: service)",
      "#      service = Ingreso recurrente (ej: mantenimiento web que cobras)",
      "#      payment = Egreso recurrente (ej: hosting que pagas mensualmente)",
      "#    Ejemplo ingreso: recurrente,Mantenimiento Web,Mermoz,50.00,,,,,service",
      "#    Ejemplo egreso:  recurrente,Hosting Mensual,Proveedor Cloud,15.00,,,,,payment",
      "#",
      "# 4. MOVIMIENTO (Transacción)",
      "#    Columnas usadas: Nombre (opcional), Monto, Fecha, FechaImputada, Categoria, Concepto",
      "#    Categoria: presupuesto | recurring | other",
      "#    Nombre: Nombre del Presupuesto/Recurrente al que vincular (opcional).",
      "#            El sistema busca automáticamente en presupuestos y recurrentes.",
      "#    FechaImputada: Si se omite, se usa la Fecha. Útil para imputar a otro mes.",
      "#    Ejemplo vinculado:  movimiento,Web Mermoz,,500.00,2024-03-01,2024-03-01,presupuesto,Pago Hito 1,",
      "#    Ejemplo libre:      movimiento,,,100.00,2024-03-05,,other,Gasto vario,",
      "#",
      "# ============================================================",
      "# ORDEN RECOMENDADO: clientes → presupuestos → recurrentes → movimientos",
      "# (para que las entidades existan antes de vincularlas)",
      "# ============================================================",
      "#",
      "TipoDato,Nombre,Vinculo,Monto,Fecha,FechaImputada,Categoria,Concepto,Estado",
      "# --- Entidades ---",
      "cliente,Mermoz,,,,,,,",
      "cliente,Proveedor Cloud,,,,,,,",
      "# --- Presupuestos ---",
      "presupuesto,Web Mermoz,Mermoz,1500.00,,,,,ingreso",
      "presupuesto,Licencia Anual,Proveedor Cloud,120.00,,,,,egreso",
      "# --- Operaciones Recurrentes ---",
      "recurrente,Mantenimiento Web,Mermoz,50.00,,,,,service",
      "recurrente,Hosting Mensual,Proveedor Cloud,15.00,,,,,payment",
      "# --- Movimientos ---",
      "movimiento,Web Mermoz,,500.00,2024-03-01,2024-03-01,presupuesto,Pago Hito 1,",
      "movimiento,Mantenimiento Web,,50.00,2024-03-01,2024-03-01,recurring,Cobro marzo,",
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
          presupuestos: [] as {
            name: string;
            clientName: string;
            totalAmount: number;
            type: string;
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

        // Filtrar líneas de comentario (comienzan con #)
        const rows = results.data.filter(
          (row) => !row.TipoDato?.trimStart().startsWith("#"),
        );

        rows.forEach((row) => {
          // Normalización segura para evitar errores si la columna viene vacía
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
                  type: (row.Estado || "ingreso").toLowerCase().trim() === "egreso" ? "egreso" : "ingreso",
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
            description: `Se procesaron ${rows.length} filas y se vincularon automáticamente.`,
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
            Entidades y Presupuestos por nombre.
          </DialogDescription>
        </DialogHeader>

        <div className="gap-6 grid py-4">
          <div className="space-y-3 bg-muted/50 p-4 border rounded-md text-muted-foreground text-sm">
            <h4 className="flex items-center gap-2 font-semibold text-foreground">
              <FileSpreadsheet className="w-4 h-4" /> Formato del CSV:
            </h4>
            <ul className="space-y-1 pl-5 list-disc">
              <li>
                <strong>Entidades:</strong> Solo necesitan Nombre.
              </li>
              <li>
                <strong>Presupuestos:</strong> Vinculo = Nombre de la Entidad.
                Estado: ingreso | egreso.
              </li>
              <li>
                <strong>Recurrentes:</strong> Vinculo = Entidad. Estado: service
                (ingreso) | payment (egreso).
              </li>
              <li>
                <strong>Movimientos:</strong> Nombre = Presupuesto/Recurrente
                a vincular (opcional). Categoría: presupuesto | recurring |
                other.
              </li>
            </ul>
            <p className="text-xs">
              La plantilla incluye documentación detallada que puedes compartir
              con una IA para generar CSVs correctos.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadTemplate}
              className="mt-2 w-full"
            >
              <Download className="mr-2 w-4 h-4" /> Descargar Plantilla
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
