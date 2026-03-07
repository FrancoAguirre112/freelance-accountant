"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Loader2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSafeMonthsInRange } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { MaintenanceRowActions } from "@/components/maintenance-row-actions";
import { type InferSelectModel } from "drizzle-orm";
import { clients, transactions, recurringServices } from "@/db/schema";
import { TabSearch, parseSearch } from "@/components/tab-search";
import { TabFilters, useTabFilters, type FilterField } from "@/components/tab-filters";
import { CsvExportButton } from "@/components/csv-export-button";
import { SortableHeader, useSort } from "@/components/ui/sortable-header";
import { createTransactionAction } from "@/app/actions";

const SEARCH_PREFIXES = [{ key: "e", label: "Entidad" }];

type Client = InferSelectModel<typeof clients>;
type Transaction = InferSelectModel<typeof transactions>;
type Service = InferSelectModel<typeof recurringServices> & {
  client: Client | null;
};

interface MaintenanceTabProps {
  from: Date;
  to: Date;
  clients: Client[];
  transactions: Transaction[];
  services: Service[];
}

export function MaintenanceTab({
  from,
  to,
  clients,
  transactions,
  services,
}: MaintenanceTabProps) {
  const [expandedRows, setExpandedRows] = React.useState<
    Record<number, boolean>
  >({});
  const [search, setSearch] = React.useState("");
  const { sort, onSort } = useSort();
  const [generatingKey, setGeneratingKey] = React.useState<string | null>(null);
  const { values: filters, onChange: onFilterChange, onClear: onFilterClear } = useTabFilters();

  const filterFields: FilterField[] = React.useMemo(() => [
    { key: "clientId", label: "Entidad", type: "combobox", options: clients.map((c) => ({ value: c.id.toString(), label: c.name })) },
    { key: "type", label: "Tipo", type: "select", options: [
      { value: "service", label: "Ingreso" },
      { value: "payment", label: "Egreso" },
    ]},
  ], [clients]);

  const toggleRow = (id: number) =>
    setExpandedRows((p) => ({ ...p, [id]: !p[id] }));

  const relatedTransactions = transactions.filter(
    (t) =>
      t.category === "recurring" &&
      t.date >= new Date(from.setUTCHours(0, 0, 0, 0)) &&
      t.date <= new Date(to.setUTCHours(23, 59, 59, 999))
  );

  const data = services.map((service) => {
    const serviceTrans = relatedTransactions.filter(
      (t) => t.serviceId === service.id
    );

    const paymentsByMonth: Record<string, number> = {};
    let totalCollected = 0;

    serviceTrans.forEach((t) => {
      const dateToUse = t.imputedDate || t.date;
      const key = dateToUse.toISOString().slice(0, 7);

      paymentsByMonth[key] = (paymentsByMonth[key] || 0) + t.amount;
      totalCollected += t.amount;
    });

    return {
      serviceId: service.id,
      serviceName: service.name,
      serviceType: service.type || "service",
      clientId: service.clientId,
      clientName: service.client?.name || "Sin Entidad",
      monthlyFee: service.amount,
      totalCollected,
      paymentsByMonth,
    };
  });

  const filteredData = React.useMemo(() => {
    const { field, term } = parseSearch(search, SEARCH_PREFIXES);
    const lower = term.toLowerCase();

    return data.filter((item) => {
      // Structured filters
      if (filters.clientId && filters.clientId !== "all" && item.clientId?.toString() !== filters.clientId) return false;
      if (filters.type && filters.type !== "all" && item.serviceType !== filters.type) return false;

      // Search
      if (!term) return true;
      switch (field) {
        case "e":
          return item.clientName.toLowerCase().includes(lower);
        default:
          return item.serviceName.toLowerCase().includes(lower);
      }
    });
  }, [data, search, filters]);

  async function handleAutoGenerate(
    serviceId: number,
    serviceName: string,
    serviceType: string,
    monthlyFee: number,
    paid: number,
    monthId: string,
    monthLabel: string,
  ) {
    const key = `${serviceId}-${monthId}`;
    setGeneratingKey(key);
    try {
      const amount = monthlyFee - paid;
      const imputedDate = new Date(monthId + "-01T12:00:00Z");
      const today = new Date();
      today.setUTCHours(12, 0, 0, 0);

      const res = await createTransactionAction({
        date: today,
        imputedDate,
        amount,
        category: "recurring",
        description: `${serviceName} — ${monthLabel}`,
        serviceId,
        presupuestoId: null,
        status: "paid",
      });

      if (res.success) {
        toast.success(
          serviceType === "payment" ? "Pago registrado" : "Cobro registrado",
          { description: `$${amount.toLocaleString()} — ${monthLabel}` },
        );
      }
    } finally {
      setGeneratingKey(null);
    }
  }

  const sortedData = React.useMemo(() => {
    if (!sort) return filteredData;
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...filteredData].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sort.key) {
        case "entity": va = a.clientName; vb = b.clientName; break;
        case "type": va = a.serviceType; vb = b.serviceType; break;
        case "fee": va = a.monthlyFee; vb = b.monthlyFee; break;
        case "collected": va = a.totalCollected; vb = b.totalCollected; break;
        default: return 0;
      }
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
      return String(va).localeCompare(String(vb)) * mul;
    });
  }, [filteredData, sort]);

  // Stats Logic
  const months = getSafeMonthsInRange(from, to);

  const serviceItems = filteredData.filter((d) => d.serviceType === "service");
  const paymentItems = filteredData.filter((d) => d.serviceType === "payment");

  const totalIncome = serviceItems.reduce(
    (acc, curr) => acc + curr.monthlyFee * months.length,
    0,
  );
  const totalExpense = paymentItems.reduce(
    (acc, curr) => acc + curr.monthlyFee * months.length,
    0,
  );
  const totalCollectedIncome = serviceItems.reduce(
    (acc, curr) => acc + curr.totalCollected,
    0,
  );
  const totalCollectedExpense = paymentItems.reduce(
    (acc, curr) => acc + curr.totalCollected,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TabSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar operaciones recurrentes..."
          prefixes={SEARCH_PREFIXES}
          defaultLabel="operación"
        />
        <TabFilters
          fields={filterFields}
          values={filters}
          onChange={onFilterChange}
          onClear={onFilterClear}
        />
        <CsvExportButton
          getData={() =>
            filteredData.map((d) => ({
              Operación: d.serviceName,
              Entidad: d.clientName,
              Tipo: d.serviceType === "payment" ? "Egreso" : "Ingreso",
              "Monto Mensual": d.monthlyFee,
              "Cobrado/Pagado": d.totalCollected,
            }))
          }
          filename="recurrentes"
        />
      </div>

      <div className="gap-4 grid md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="font-bold text-2xl">
              ${totalIncome.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">
              Potencial Ingresos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="font-bold text-green-600 text-2xl">
              ${totalCollectedIncome.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">Cobrado Real</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="font-bold text-red-600 text-2xl">
              ${totalExpense.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">
              Potencial Egresos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="font-bold text-red-600 text-2xl">
              ${totalCollectedExpense.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">Pagado Real</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[50px]"></TableHead>
              <SortableHeader label="Entidad / Operación" sortKey="entity" sort={sort} onSort={onSort} />
              <SortableHeader label="Tipo" sortKey="type" sort={sort} onSort={onSort} />
              <SortableHeader label="Monto Mensual" sortKey="fee" sort={sort} onSort={onSort} />
              <SortableHeader label="Cobrado/Pagado" sortKey="collected" sort={sort} onSort={onSort} />
              <TableHead>Estado</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-muted-foreground text-center"
                >
                  {search
                    ? "No se encontraron resultados."
                    : "No hay operaciones recurrentes activas."}
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((item) => {
                const isPayment = item.serviceType === "payment";
                let monthsCovered = 0;
                const details = months.map((m) => {
                  const paid = item.paymentsByMonth[m.id] || 0;
                  const isCovered = paid >= item.monthlyFee;
                  if (isCovered) monthsCovered++;
                  const isPartial = paid > 0 && paid < item.monthlyFee;
                  return { ...m, paid, isCovered, isPartial };
                });

                return (
                  <React.Fragment key={item.serviceId}>
                    <TableRow
                      className={cn(
                        "hover:bg-muted/50 transition-colors",
                        expandedRows[item.serviceId] &&
                          "bg-muted/50 border-b-0",
                      )}
                    >
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6"
                          onClick={() => toggleRow(item.serviceId)}
                        >
                          {expandedRows[item.serviceId] ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell
                        className="cursor-pointer"
                        onClick={() => toggleRow(item.serviceId)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{item.clientName}</span>
                          <span className="text-muted-foreground text-xs">
                            {item.serviceName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            isPayment
                              ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                              : "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                          }
                        >
                          {isPayment ? "Egreso" : "Ingreso"}
                        </Badge>
                      </TableCell>
                      <TableCell className={isPayment ? "text-red-600" : ""}>
                        ${item.monthlyFee}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-medium",
                          item.totalCollected >= item.monthlyFee * months.length
                            ? isPayment ? "text-red-600" : "text-green-600"
                            : "",
                        )}
                      >
                        ${item.totalCollected.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {monthsCovered === months.length &&
                          months.length > 0 ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <Clock className="w-3 h-3 text-muted-foreground" />
                          )}
                          {monthsCovered}/{months.length}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <MaintenanceRowActions
                          service={item}
                          clients={clients}
                        />
                      </TableCell>
                    </TableRow>

                    {expandedRows[item.serviceId] && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={7} className="p-0">
                          <div className="p-4 pl-12">
                            <h4 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                              Detalle Mensual
                            </h4>
                            <div className="gap-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                              {details.map((d, idx) => {
                                const cardKey = `${item.serviceId}-${d.id}`;
                                const isGenerating = generatingKey === cardKey;
                                const canGenerate = !d.isCovered;
                                const remaining = item.monthlyFee - d.paid;

                                return (
                                <div
                                  key={idx}
                                  className={cn(
                                    "flex flex-col items-center p-3 border rounded-md text-sm text-center transition-all",
                                    d.isCovered
                                      ? isPayment
                                        ? "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                                        : "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                                      : d.isPartial
                                        ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800"
                                        : "bg-card border-border",
                                  )}
                                >
                                  <span className="mb-1 font-medium">
                                    {d.label}
                                  </span>
                                  {d.isCovered ? (
                                    <span className={cn(
                                      "font-bold text-xs",
                                      isPayment
                                        ? "text-red-700 dark:text-red-400"
                                        : "text-green-700 dark:text-green-400",
                                    )}>
                                      {isPayment ? "Pagado" : "Cobrado"} (${d.paid.toLocaleString()}/${item.monthlyFee})
                                    </span>
                                  ) : d.isPartial ? (
                                    <span className="font-bold text-yellow-700 dark:text-yellow-400 text-xs">
                                      Parcial (${d.paid.toLocaleString()}/${item.monthlyFee})
                                    </span>
                                  ) : (
                                    <span className="font-medium text-muted-foreground text-xs">
                                      Pendiente
                                    </span>
                                  )}
                                  {canGenerate && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="mt-1.5 h-6 px-2 text-[0.65rem] gap-1"
                                      disabled={isGenerating}
                                      onClick={() =>
                                        handleAutoGenerate(
                                          item.serviceId,
                                          item.serviceName,
                                          item.serviceType,
                                          item.monthlyFee,
                                          d.paid,
                                          d.id,
                                          d.label,
                                        )
                                      }
                                    >
                                      {isGenerating ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Zap className="w-3 h-3" />
                                      )}
                                      {isPayment ? "Pagar" : "Cobrar"} ${remaining}
                                    </Button>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
