"use client";

import { useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RowActions } from "./tables/row-actions";
import { type InferSelectModel } from "drizzle-orm";
import { presupuestos, clients, transactions } from "@/db/schema";
import { TabSearch, parseSearch } from "@/components/tab-search";
import { TabFilters, useTabFilters, type FilterField } from "@/components/tab-filters";
import { CsvExportButton } from "@/components/csv-export-button";
import { SortableHeader, useSort } from "@/components/ui/sortable-header";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SkeletonCells } from "@/components/ui/skeleton-row";
import { updatePresupuestoAction, createTransactionAction } from "@/app/actions";
import { toast } from "sonner";

type Client = InferSelectModel<typeof clients>;
type Transaction = InferSelectModel<typeof transactions>;
type Presupuesto = InferSelectModel<typeof presupuestos> & {
  client: Client | null;
  transactions: Transaction[];
};

const SEARCH_PREFIXES = [{ key: "e", label: "Entidad" }];

export function PresupuestosTab({
  presupuestos,
  clients,
}: {
  presupuestos: Presupuesto[];
  clients: Client[];
}) {
  const [search, setSearch] = useState("");
  const [loadingRows, setLoadingRows] = useState<Set<number>>(new Set());
  const { sort, onSort } = useSort();
  const { values: filters, onChange: onFilterChange, onClear: onFilterClear } = useTabFilters();

  const filterFields: FilterField[] = useMemo(() => [
    { key: "type", label: "Tipo", type: "select", options: [
      { value: "ingreso", label: "Ingresos" },
      { value: "egreso", label: "Egresos" },
    ]},
    { key: "clientId", label: "Entidad", type: "combobox", options: clients.map((c) => ({ value: c.id.toString(), label: c.name })) },
    { key: "status", label: "Estado", type: "select", options: [
      { value: "activo", label: "Activo" },
      { value: "finalizado", label: "Finalizado" },
      { value: "pausado", label: "Pausado" },
    ]},
    { key: "showFinished", label: "Mostrar Finalizados", type: "switch" },
  ], [clients]);

  const processedPresupuestos = useMemo(() => {
    const { field, term } = parseSearch(search, SEARCH_PREFIXES);
    const lower = term.toLowerCase();

    return presupuestos
      .map((p) => {
        const totalPaid = p.transactions.reduce((acc, t) => acc + Math.abs(t.amount), 0);
        return { ...p, totalPaid };
      })
      .filter((p) => {
        if (filters.showFinished !== "true") {
          if (p.status === "finalizado" || p.totalPaid >= p.totalAmount)
            return false;
        }
        if (filters.type && filters.type !== "all" && p.type !== filters.type) return false;
        if (filters.clientId && filters.clientId !== "all" && p.clientId?.toString() !== filters.clientId) return false;
        if (filters.status && filters.status !== "all" && p.status !== filters.status) return false;

        if (!term) return true;
        switch (field) {
          case "e":
            return (p.client?.name || "").toLowerCase().includes(lower);
          default:
            return p.name.toLowerCase().includes(lower);
        }
      });
  }, [presupuestos, filters, search]);

  const sorted = useMemo(() => {
    if (!sort) return processedPresupuestos;
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...processedPresupuestos].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sort.key) {
        case "type": va = a.type; vb = b.type; break;
        case "name": va = a.name; vb = b.name; break;
        case "budget": va = a.totalAmount; vb = b.totalAmount; break;
        case "paid": va = a.totalPaid; vb = b.totalPaid; break;
        case "progress": va = a.totalAmount > 0 ? a.totalPaid / a.totalAmount : 0; vb = b.totalAmount > 0 ? b.totalPaid / b.totalAmount : 0; break;
        case "status": va = a.status || ""; vb = b.status || ""; break;
        default: return 0;
      }
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
      return String(va).localeCompare(String(vb)) * mul;
    });
  }, [processedPresupuestos, sort]);

  const totalBudget = processedPresupuestos.reduce((s, p) => s + p.totalAmount, 0);
  const totalPaidAll = processedPresupuestos.reduce((s, p) => s + p.totalPaid, 0);

  const getExportData = () =>
    processedPresupuestos.map((p) => ({
      Nombre: p.name,
      Tipo: p.type === "ingreso" ? "Ingreso" : "Egreso",
      Entidad: p.client?.name || "",
      "Monto Total": p.totalAmount,
      Cobrado: p.totalPaid,
      Pendiente: p.totalAmount - p.totalPaid,
      Estado: p.status || "",
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TabSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar presupuestos..."
          prefixes={SEARCH_PREFIXES}
          defaultLabel="presupuesto"
        />
        <TabFilters
          fields={filterFields}
          values={filters}
          onChange={onFilterChange}
          onClear={onFilterClear}
        />
        <CsvExportButton getData={getExportData} filename="presupuestos" />
      </div>

      <div className="bg-card border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader label="Tipo" sortKey="type" sort={sort} onSort={onSort} className="w-[70px]" />
              <SortableHeader label="Nombre / Entidad" sortKey="name" sort={sort} onSort={onSort} />
              <SortableHeader label="Monto Total" sortKey="budget" sort={sort} onSort={onSort} />
              <SortableHeader label="Cobrado" sortKey="paid" sort={sort} onSort={onSort} />
              <SortableHeader label="Progreso" sortKey="progress" sort={sort} onSort={onSort} />
              <SortableHeader label="Estado" sortKey="status" sort={sort} onSort={onSort} className="text-right" />
              <TableHead className="w-[70px] text-center">Activo</TableHead>
              <TableHead className="w-[90px] text-center">Saldar</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => {
              const { totalPaid } = p;
              const isIngreso = p.type === "ingreso";
              const amountColor = isIngreso ? "text-green-600" : "text-red-600";
              const progressPercentage = Math.min(
                (totalPaid / p.totalAmount) * 100,
                100,
              );

              let statusLabel = "Pendiente";
              let statusColor = "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800";

              if (totalPaid >= p.totalAmount) {
                statusLabel = isIngreso ? "Cobrado Total" : "Saldado";
                statusColor = "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800";
              } else if (totalPaid > 0) {
                statusLabel = "Pago Parcial";
                statusColor = "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800";
              }

              const isRowLoading = loadingRows.has(p.id);
              return (
                <TableRow key={p.id} className={isRowLoading ? "animate-pulse" : ""}>
                  {isRowLoading ? (
                    <SkeletonCells widths={["w-8", "w-32", "w-16", "w-16", "w-28", "w-20", "w-10", "w-16"]} />
                  ) : (
                    <>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isIngreso ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800" : "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"}`}>
                          {isIngreso ? "IN" : "EG"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {p.client?.name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${p.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className={amountColor}>
                        ${totalPaid.toLocaleString()}
                      </TableCell>
                      <TableCell className="w-[200px]">
                        <div className="flex items-center gap-2">
                          <Progress value={progressPercentage} className="h-2 flex-1" />
                          <span className="text-[10px] text-muted-foreground w-8 text-right">
                            {progressPercentage.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={statusColor}>
                          {statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={p.status === "activo"}
                          onCheckedChange={async (checked) => {
                            setLoadingRows((prev) => new Set(prev).add(p.id));
                            await updatePresupuestoAction(p.id, { status: checked ? "activo" : "pausado" });
                            setLoadingRows((prev) => {
                              const next = new Set(prev);
                              next.delete(p.id);
                              return next;
                            });
                          }}
                          disabled={p.status === "finalizado"}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            p.status === "finalizado" ||
                            totalPaid >= p.totalAmount ||
                            p.totalAmount - totalPaid <= 0
                          }
                          onClick={async () => {
                            const remaining = p.totalAmount - totalPaid;
                            setLoadingRows((prev) => new Set(prev).add(p.id));
                            try {
                              const today = new Date();
                              today.setUTCHours(12, 0, 0, 0);
                              const res = await createTransactionAction({
                                date: today,
                                imputedDate: today,
                                amount: remaining,
                                presupuestoId: p.id,
                                serviceId: null,
                                category: "presupuesto",
                                description: `Saldo — ${p.name}`,
                                status: "paid",
                              });
                              if (res.success) {
                                toast.success("Presupuesto saldado", {
                                  description: `$${remaining.toLocaleString()} — ${p.name}`,
                                });
                              }
                            } finally {
                              setLoadingRows((prev) => {
                                const next = new Set(prev);
                                next.delete(p.id);
                                return next;
                              });
                            }
                          }}
                        >
                          Saldar
                        </Button>
                      </TableCell>
                      <TableCell>
                        <RowActions
                          row={p}
                          type="presupuesto"
                          clients={clients}
                          onLoadingChange={(l) => {
                            setLoadingRows((prev) => {
                              const next = new Set(prev);
                              if (l) next.add(p.id); else next.delete(p.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          {sorted.length > 0 && (
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell />
              <TableCell className="text-muted-foreground text-xs uppercase">
                {sorted.length} presupuesto{sorted.length !== 1 ? "s" : ""}
              </TableCell>
              <TableCell>${totalBudget.toLocaleString()}</TableCell>
              <TableCell>
                ${totalPaidAll.toLocaleString()}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress
                    value={totalBudget > 0 ? Math.min((totalPaidAll / totalBudget) * 100, 100) : 0}
                    className="h-2 flex-1"
                  />
                  <span className="text-[10px] text-muted-foreground w-8 text-right">
                    {totalBudget > 0 ? ((totalPaidAll / totalBudget) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell />
            </TableRow>
          )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
