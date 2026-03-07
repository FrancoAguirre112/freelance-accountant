"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RowActions } from "@/components/tables/row-actions";
import { formatSafeDate } from "@/lib/date-utils";
import { TabSearch, parseSearch } from "@/components/tab-search";
import {
  TabFilters,
  useTabFilters,
  type FilterField,
} from "@/components/tab-filters";
import { CsvExportButton } from "@/components/csv-export-button";
import { formatSafeDate as fmtDate } from "@/lib/date-utils";
import { SortableHeader, useSort } from "@/components/ui/sortable-header";

interface TransactionWithRelations {
  id: number;
  date: Date;
  imputedDate: Date | null;
  amount: number;
  category: "presupuesto" | "recurring" | "other";
  description: string | null;
  presupuestoId: number | null;
  serviceId: number | null;
  status: string | null;
  userId: string;
  presupuesto?: {
    name: string;
    type: string;
    client?: { name: string } | null;
  } | null;
}

type TransactionCategory = "presupuesto" | "recurring" | "other";

const SEARCH_PREFIXES = [
  { key: "e", label: "Entidad" },
  { key: "d", label: "Descripción" },
  { key: "m", label: "Monto" },
];

export function TransactionsTab({
  preFilteredData,
}: {
  from: Date;
  to: Date;
  preFilteredData?: any[];
}) {
  const [search, setSearch] = React.useState("");
  const { sort, onSort } = useSort();
  const {
    values: filters,
    onChange: onFilterChange,
    onClear: onFilterClear,
  } = useTabFilters();

  const filterFields: FilterField[] = React.useMemo(
    () => [
      {
        key: "category",
        label: "Categoría",
        type: "select",
        options: [
          { value: "presupuesto", label: "Presupuesto" },
          { value: "recurring", label: "Recurrente" },
          { value: "other", label: "Otro" },
        ],
      },
    ],
    [],
  );

  const data = React.useMemo(
    () => (preFilteredData ?? []) as TransactionWithRelations[],
    [preFilteredData],
  );

  const filtered = React.useMemo(() => {
    const { field, term } = parseSearch(search, SEARCH_PREFIXES);
    const lower = term.toLowerCase();

    return data.filter((t) => {
      // Apply structured filters
      if (
        filters.category &&
        filters.category !== "all" &&
        t.category !== filters.category
      )
        return false;

      // Apply search
      if (!term) return true;
      const clientName =
        t.presupuesto?.client?.name || "";
      const sourceName = t.presupuesto?.name || "";

      switch (field) {
        case "e":
          return clientName.toLowerCase().includes(lower);
        case "d":
          return (t.description || "").toLowerCase().includes(lower);
        case "m":
          return t.amount.toFixed(2).includes(term);
        default:
          return sourceName.toLowerCase().includes(lower);
      }
    });
  }, [data, search, filters]);

  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sort.key) {
        case "date": va = a.date.getTime(); vb = b.date.getTime(); break;
        case "entity": va = a.presupuesto?.client?.name || ""; vb = b.presupuesto?.client?.name || ""; break;
        case "category": va = a.category; vb = b.category; break;
        case "description": va = a.description || ""; vb = b.description || ""; break;
        case "amount": va = a.amount; vb = b.amount; break;
        default: return 0;
      }
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
      return String(va).localeCompare(String(vb)) * mul;
    });
  }, [filtered, sort]);

  const categoryColors: Record<TransactionCategory, string> = {
    presupuesto:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    recurring:
      "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
    other:
      "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  };

  const getCategoryLabel = (t: TransactionWithRelations) => {
    if (t.category === "presupuesto") {
      return t.presupuesto?.type === "egreso" ? "Pago" : "Ingreso";
    }
    if (t.category === "recurring") return "Recurrente";
    return "Otro";
  };

  const categoryLabels: Record<TransactionCategory, string> = {
    presupuesto: "Presupuesto",
    recurring: "Recurrente",
    other: "Otro",
  };

  const isExpense = (t: TransactionWithRelations) => t.amount < 0;

  const totalIncome = filtered
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const getExportData = () =>
    filtered.map((t) => ({
      Fecha: fmtDate(t.date, "yyyy-MM-dd"),
      Entidad: t.presupuesto?.client?.name || "",
      Origen: t.presupuesto?.name || "",
      Categoría: getCategoryLabel(t),
      Descripción: t.description || "",
      Monto: t.amount,
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TabSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar movimientos por origen..."
          prefixes={SEARCH_PREFIXES}
          defaultLabel="origen"
        />
        <TabFilters
          fields={filterFields}
          values={filters}
          onChange={onFilterChange}
          onClear={onFilterClear}
        />
        <CsvExportButton getData={getExportData} filename="movimientos" />
      </div>

      <div className="bg-card border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader label="Fecha" sortKey="date" sort={sort} onSort={onSort} />
              <SortableHeader label="Entidad / Origen" sortKey="entity" sort={sort} onSort={onSort} />
              <SortableHeader label="Categoría" sortKey="category" sort={sort} onSort={onSort} />
              <SortableHeader label="Descripción" sortKey="description" sort={sort} onSort={onSort} />
              <SortableHeader label="Monto (USD)" sortKey="amount" sort={sort} onSort={onSort} className="text-right" />
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-muted-foreground text-center"
                >
                  {search
                    ? "No se encontraron resultados."
                    : "No hay movimientos en este rango de fechas."}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((t) => {
                const clientName =
                  t.presupuesto?.client?.name ||
                  "Sin Entidad";

                const sourceName =
                  t.presupuesto?.name || "Movimiento Directo";

                return (
                  <TableRow key={t.id}>
                    <TableCell className="min-w-[100px]">
                      {formatSafeDate(t.date, "dd/MM/yyyy")}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {clientName}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {sourceName}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          categoryColors[t.category as TransactionCategory] ||
                          categoryColors.other
                        }
                      >
                        {categoryLabels[t.category as TransactionCategory] ||
                          t.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-muted-foreground">
                      {t.description || "-"}
                    </TableCell>
                    <TableCell
                      className={`font-bold text-right ${isExpense(t) ? "text-red-600" : "text-green-600"}`}
                    >
                      {isExpense(t) ? "- " : "+ "}$
                      {Math.abs(t.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <RowActions row={t} type="transaction" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          {sorted.length > 0 && (
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell colSpan={4} className="text-right text-muted-foreground text-xs uppercase">
                {sorted.length} movimiento{sorted.length !== 1 ? "s" : ""}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-green-600 text-xs">+ ${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="text-red-600 text-xs">- ${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </TableCell>
              <TableCell />
            </TableRow>
          )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
