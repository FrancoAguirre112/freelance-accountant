"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RowActions } from "./tables/row-actions";
import { type InferSelectModel } from "drizzle-orm";
import { pagos, clients, transactions } from "@/db/schema";
import { TabSearch, parseSearch } from "@/components/tab-search";
import { TabFilters, useTabFilters, type FilterField } from "@/components/tab-filters";
import { CsvExportButton } from "@/components/csv-export-button";
import { SortableHeader, useSort } from "@/components/ui/sortable-header";

const SEARCH_PREFIXES = [{ key: "e", label: "Entidad" }];

type Client = InferSelectModel<typeof clients>;
type Transaction = InferSelectModel<typeof transactions>;
type Pago = InferSelectModel<typeof pagos> & {
  client: Client | null;
  transactions: Transaction[];
};

export function PagosTab({
  pagos,
  clients,
}: {
  pagos: Pago[];
  clients: Client[];
}) {
  const [search, setSearch] = useState("");
  const { sort, onSort } = useSort();
  const { values: filters, onChange: onFilterChange, onClear: onFilterClear } = useTabFilters();

  const filterFields: FilterField[] = useMemo(() => [
    { key: "clientId", label: "Entidad", type: "combobox", options: clients.map((c) => ({ value: c.id.toString(), label: c.name })) },
    { key: "status", label: "Estado", type: "select", options: [
      { value: "pendiente", label: "Pendiente" },
      { value: "pago_parcial", label: "Pago Parcial" },
      { value: "saldado", label: "Saldado" },
    ]},
    { key: "showSettled", label: "Mostrar Saldados", type: "switch" },
  ], [clients]);

  const processedPagos = useMemo(() => {
    const { field, term } = parseSearch(search, SEARCH_PREFIXES);
    const lower = term.toLowerCase();

    return pagos
      .map((pago) => {
        const totalPaid = pago.transactions.reduce(
          (acc, t) => acc + t.amount,
          0,
        );
        return { ...pago, totalPaid };
      })
      .filter((pago) => {
        // Structured filters
        if (filters.showSettled !== "true") {
          if (pago.status === "saldado" || pago.totalPaid >= pago.totalAmount)
            return false;
        }
        if (filters.clientId && filters.clientId !== "all" && pago.clientId?.toString() !== filters.clientId) return false;
        if (filters.status && filters.status !== "all" && pago.status !== filters.status) return false;

        // Search
        if (!term) return true;
        switch (field) {
          case "e":
            return (pago.client?.name || "").toLowerCase().includes(lower);
          default:
            return pago.name.toLowerCase().includes(lower);
        }
      });
  }, [pagos, filters, search]);

  const sorted = useMemo(() => {
    if (!sort) return processedPagos;
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...processedPagos].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sort.key) {
        case "name": va = a.name; vb = b.name; break;
        case "total": va = a.totalAmount; vb = b.totalAmount; break;
        case "paid": va = a.totalPaid; vb = b.totalPaid; break;
        case "progress": va = a.totalAmount > 0 ? a.totalPaid / a.totalAmount : 0; vb = b.totalAmount > 0 ? b.totalPaid / b.totalAmount : 0; break;
        case "status": va = a.status || ""; vb = b.status || ""; break;
        default: return 0;
      }
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
      return String(va).localeCompare(String(vb)) * mul;
    });
  }, [processedPagos, sort]);

  const totalAmount = processedPagos.reduce((s, p) => s + p.totalAmount, 0);
  const totalPaidAll = processedPagos.reduce((s, p) => s + p.totalPaid, 0);

  const getExportData = () =>
    processedPagos.map((p) => ({
      Pago: p.name,
      Entidad: p.client?.name || "",
      "Monto Total": p.totalAmount,
      Pagado: p.totalPaid,
      Pendiente: p.totalAmount - p.totalPaid,
      Estado: p.status || "",
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TabSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar pagos..."
          prefixes={SEARCH_PREFIXES}
          defaultLabel="pago"
        />
        <TabFilters
          fields={filterFields}
          values={filters}
          onChange={onFilterChange}
          onClear={onFilterClear}
        />
        <CsvExportButton getData={getExportData} filename="pagos" />
      </div>

      <div className="bg-card border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader label="Pago / Entidad" sortKey="name" sort={sort} onSort={onSort} />
              <SortableHeader label="Monto Total" sortKey="total" sort={sort} onSort={onSort} />
              <SortableHeader label="Pagado" sortKey="paid" sort={sort} onSort={onSort} />
              <SortableHeader label="Progreso" sortKey="progress" sort={sort} onSort={onSort} />
              <SortableHeader label="Estado" sortKey="status" sort={sort} onSort={onSort} className="text-right" />
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((pago) => {
              const { totalPaid } = pago;
              const progressPercentage = Math.min(
                (totalPaid / pago.totalAmount) * 100,
                100,
              );

              let statusLabel = "Pendiente";
              let statusColor = "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800";

              if (totalPaid >= pago.totalAmount) {
                statusLabel = "Saldado";
                statusColor = "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800";
              } else if (totalPaid > 0) {
                statusLabel = "Pago Parcial";
                statusColor = "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800";
              }

              return (
                <TableRow key={pago.id}>
                  <TableCell>
                    <div className="font-medium">{pago.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {pago.client?.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    ${pago.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-red-600">
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
                  <TableCell>
                    <RowActions row={pago} type="pago" clients={clients} />
                  </TableCell>
                </TableRow>
              );
            })}
          {sorted.length > 0 && (
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell className="text-muted-foreground text-xs uppercase">
                {sorted.length} pago{sorted.length !== 1 ? "s" : ""}
              </TableCell>
              <TableCell>${totalAmount.toLocaleString()}</TableCell>
              <TableCell className="text-red-600">
                ${totalPaidAll.toLocaleString()}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress
                    value={totalAmount > 0 ? Math.min((totalPaidAll / totalAmount) * 100, 100) : 0}
                    className="h-2 flex-1"
                  />
                  <span className="text-[10px] text-muted-foreground w-8 text-right">
                    {totalAmount > 0 ? ((totalPaidAll / totalAmount) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              </TableCell>
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
