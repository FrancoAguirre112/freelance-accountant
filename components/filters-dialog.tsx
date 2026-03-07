"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type InferSelectModel } from "drizzle-orm";
import { clients, presupuestos } from "@/db/schema";
import { SearchableFilterSelect } from "./searchable-filter-select"; // Importamos el nuevo componente

type Client = InferSelectModel<typeof clients>;
type Presupuesto = InferSelectModel<typeof presupuestos>;

interface FiltersDialogProps {
  clients: Client[];
  presupuestos: Presupuesto[];
}

export function FiltersDialog({ clients, presupuestos }: FiltersDialogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);

  const [clientId, setClientId] = React.useState(
    searchParams.get("clientId") || "all",
  );
  const [presupuestoId, setPresupuestoId] = React.useState(
    searchParams.get("presupuestoId") || "all",
  );
  const [category, setCategory] = React.useState(
    searchParams.get("category") || "all",
  );
  const handleApply = () => {
    const params = new URLSearchParams(searchParams.toString());

    if (clientId && clientId !== "all") params.set("clientId", clientId);
    else params.delete("clientId");

    if (presupuestoId && presupuestoId !== "all") params.set("presupuestoId", presupuestoId);
    else params.delete("presupuestoId");

    if (category && category !== "all") params.set("category", category);
    else params.delete("category");

    router.push(`/?${params.toString()}`);
    setOpen(false);
  };

  const handleClear = () => {
    setClientId("all");
    setPresupuestoId("all");
    setCategory("all");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filtros
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Filtrar Dashboard</DialogTitle>
          <DialogDescription>
            Combina los criterios para refinar los resultados.
          </DialogDescription>
        </DialogHeader>

        {/* LAYOUT GRID: 2 columnas base */}
        <div className="gap-4 grid grid-cols-2 py-4">
          {/* FILTRO: ENTIDAD (Full Width) */}
          <div className="col-span-2">
            <SearchableFilterSelect
              label="Entidad"
              placeholder="Seleccionar entidad"
              items={clients}
              value={clientId}
              onValueChange={setClientId}
            />
          </div>

          {/* FILTRO: PRESUPUESTO (Full Width) */}
          <div className="col-span-2">
            <SearchableFilterSelect
              label="Presupuesto"
              placeholder="Seleccionar presupuesto"
              items={presupuestos}
              value={presupuestoId}
              onValueChange={setPresupuestoId}
            />
          </div>

          {/* FILTROS SECUNDARIOS (50% cada uno) */}
          <div className="space-y-2 col-span-1">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="presupuesto">Presupuesto</SelectItem>
                <SelectItem value="recurring">Recurrente</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>
        <DialogFooter className="flex justify-between sm:justify-between w-full">
          <Button variant="ghost" onClick={handleClear}>
            Limpiar
          </Button>
          <Button onClick={handleApply}>Aplicar Filtros</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
