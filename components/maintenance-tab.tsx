"use client";

import * as React from "react";
import {
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSafeMonthsInRange } from "@/lib/date-utils";
import {
  isServiceActiveInMonth,
  isServiceActiveInRange,
} from "@/lib/recurring";
import { cn } from "@/lib/utils";
import { MaintenanceRowActions } from "@/components/maintenance-row-actions";
import { type InferSelectModel } from "drizzle-orm";
import { clients, transactions, recurringServices } from "@/db/schema";
import { TabSearch, parseSearch } from "@/components/tab-search";
import { TabFilters, useTabFilters, type FilterField } from "@/components/tab-filters";
import { CsvExportButton } from "@/components/csv-export-button";
import { SortableHeader, useSort } from "@/components/ui/sortable-header";
import { SkeletonCells } from "@/components/ui/skeleton-row";
import { createTransactionAction } from "@/app/actions";

const SEARCH_PREFIXES = [{ key: "e", label: "Entidad" }];

type Client = InferSelectModel<typeof clients>;
type Transaction = InferSelectModel<typeof transactions>;
type Service = InferSelectModel<typeof recurringServices> & {
  client: Client | null;
  billingDay?: number;
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
  const [loadingRows, setLoadingRows] = React.useState<Set<number>>(new Set());
  const { sort, onSort } = useSort();
  const [generatingKey, setGeneratingKey] = React.useState<string | null>(null);
  const [monthModal, setMonthModal] = React.useState<{
    serviceId: number;
    serviceName: string;
    serviceType: string;
    monthlyFee: number;
    monthId: string;
    monthLabel: string;
    paid: number;
    isCovered: boolean;
    transactions: Transaction[];
  } | null>(null);
  const { values: filters, onChange: onFilterChange, onClear: onFilterClear } = useTabFilters();

  const filterFields: FilterField[] = React.useMemo(() => [
    { key: "clientId", label: "Entidad", type: "combobox", options: clients.map((c) => ({ value: c.id.toString(), label: c.name })) },
    { key: "type", label: "Tipo", type: "select", options: [
      { value: "service", label: "Ingreso" },
      { value: "payment", label: "Egreso" },
    ]},
    { key: "vencimiento", label: "Vencimiento", type: "select", options: [
      { value: "vencido", label: "Vencido" },
      { value: "por_vencer", label: "Por vencer" },
      { value: "al_dia", label: "Al día" },
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

  const allRecurringTransactions = transactions.filter(
    (t) => t.category === "recurring"
  );

  // Only show services whose lifecycle intersects the selected date range.
  const activeServices = services.filter((service) =>
    isServiceActiveInRange(service, from, to),
  );

  const data = activeServices.map((service) => {
    const serviceTrans = relatedTransactions.filter(
      (t) => t.serviceId === service.id
    );

    const paymentsByMonth: Record<string, number> = {};
    const transactionsByMonth: Record<string, Transaction[]> = {};
    let totalCollected = 0;

    serviceTrans.forEach((t) => {
      const dateToUse = t.imputedDate || t.date;
      const key = dateToUse.toISOString().slice(0, 7);

      paymentsByMonth[key] = (paymentsByMonth[key] || 0) + t.amount;
      if (!transactionsByMonth[key]) transactionsByMonth[key] = [];
      transactionsByMonth[key].push(t);
      totalCollected += t.amount;
    });

    // Compute last paid date (from all transactions, not just period)
    const allServiceTrans = allRecurringTransactions.filter(
      (t) => t.serviceId === service.id
    );
    let lastPaidDate: Date | null = null;
    if (allServiceTrans.length > 0) {
      lastPaidDate = allServiceTrans.reduce((latest, t) => {
        return t.date > latest ? t.date : latest;
      }, allServiceTrans[0].date);
    }

    // Compute next due date based on billingDay cycle (NOT last payment date)
    // Walk forward from current month checking which months are covered
    const billingDay = service.billingDay || 1;
    const now = new Date();
    let nextDueDate!: Date;

    // Build a map of all-time payments by month for this service
    const allPaymentsByMonth: Record<string, number> = {};
    allServiceTrans.forEach((t) => {
      const dateToUse = t.imputedDate || t.date;
      const key = dateToUse.toISOString().slice(0, 7);
      allPaymentsByMonth[key] = (allPaymentsByMonth[key] || 0) + t.amount;
    });

    // Find the first uncovered month, then due date = billingDay of the NEXT month
    // (e.g. Feb service is due on billingDay of March, Mar service is due on billingDay of April)
    // Only look back 1 month (in case billing day hasn't passed yet this month)
    // Skip months outside the service lifecycle
    let found = false;
    for (let offset = -1; offset <= 1; offset++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
      const key = d.toISOString().slice(0, 7);
      if (!isServiceActiveInMonth(service, key)) continue;
      const paid = allPaymentsByMonth[key] || 0;
      if (paid < service.amount) {
        // Due date is billingDay of month AFTER the uncovered month
        const dueMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
        const maxDay = new Date(dueMonth.getUTCFullYear(), dueMonth.getUTCMonth() + 1, 0).getDate();
        nextDueDate = new Date(Date.UTC(dueMonth.getUTCFullYear(), dueMonth.getUTCMonth(), Math.min(billingDay, maxDay), 12, 0, 0, 0));
        found = true;
        break;
      }
    }
    if (!found) {
      // All months covered — next due is billingDay two months from now
      const dueMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));
      const maxDay = new Date(dueMonth.getUTCFullYear(), dueMonth.getUTCMonth() + 1, 0).getDate();
      nextDueDate = new Date(Date.UTC(dueMonth.getUTCFullYear(), dueMonth.getUTCMonth(), Math.min(billingDay, maxDay), 12, 0, 0, 0));
    }

    // Compute due status for filtering and badge
    const diffMs = nextDueDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const dueStatus: "vencido" | "por_vencer" | "al_dia" =
      diffDays < 0 ? "vencido" : diffDays <= 2 ? "por_vencer" : "al_dia";

    return {
      serviceId: service.id,
      serviceName: service.name,
      serviceType: service.type || "service",
      clientId: service.clientId,
      clientName: service.client?.name || "Sin Entidad",
      monthlyFee: service.amount,
      totalCollected,
      paymentsByMonth,
      transactionsByMonth,
      lastPaidDate,
      nextDueDate,
      billingDay,
      dueStatus,
      startDate: service.startDate,
      endDate: service.endDate,
    };
  });

  const filteredData = React.useMemo(() => {
    const { field, term } = parseSearch(search, SEARCH_PREFIXES);
    const lower = term.toLowerCase();

    return data.filter((item) => {
      // Structured filters
      if (filters.clientId && filters.clientId !== "all" && item.clientId?.toString() !== filters.clientId) return false;
      if (filters.type && filters.type !== "all" && item.serviceType !== filters.type) return false;
      if (filters.vencimiento && filters.vencimiento !== "all" && item.dueStatus !== filters.vencimiento) return false;

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
        case "nextDue": va = a.nextDueDate.getTime(); vb = b.nextDueDate.getTime(); break;
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

  const getActiveMonthCount = (item: typeof filteredData[0]) =>
    months.filter((m) =>
      isServiceActiveInMonth(
        { startDate: item.startDate, endDate: item.endDate },
        m.id,
      ),
    ).length;

  const totalIncome = serviceItems.reduce(
    (acc, curr) => acc + curr.monthlyFee * getActiveMonthCount(curr),
    0,
  );
  const totalExpense = paymentItems.reduce(
    (acc, curr) => acc + curr.monthlyFee * getActiveMonthCount(curr),
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
              <SortableHeader label="Próximo Vencimiento" sortKey="nextDue" sort={sort} onSort={onSort} />
              <TableHead>Estado</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
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
                // Only show months inside the service lifecycle
                const activeMonths = months.filter((m) =>
                  isServiceActiveInMonth(
                    { startDate: item.startDate, endDate: item.endDate },
                    m.id,
                  ),
                );
                let monthsCovered = 0;
                const details = activeMonths.map((m) => {
                  const paid = item.paymentsByMonth[m.id] || 0;
                  const isCovered = paid >= item.monthlyFee;
                  if (isCovered) monthsCovered++;
                  const isPartial = paid > 0 && paid < item.monthlyFee;
                  return { ...m, paid, isCovered, isPartial };
                });

                const isRowLoading = loadingRows.has(item.serviceId);
                return (
                  <React.Fragment key={item.serviceId}>
                    <TableRow
                      className={cn(
                        "hover:bg-muted/50 transition-colors",
                        expandedRows[item.serviceId] &&
                          "bg-muted/50 border-b-0",
                        isRowLoading && "animate-pulse",
                      )}
                    >
                      {isRowLoading ? (
                        <SkeletonCells widths={["w-6", "w-32", "w-16", "w-12", "w-16", "w-20", "w-12"]} />
                      ) : (
                        <>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6"
                              onClick={() => toggleRow(item.serviceId)}
                            >
                              <ChevronRight
                                className="w-4 h-4 animate-chevron"
                                data-expanded={expandedRows[item.serviceId] ? "true" : "false"}
                              />
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
                              item.totalCollected >= item.monthlyFee * activeMonths.length
                                ? isPayment ? "text-red-600" : "text-green-600"
                                : "",
                            )}
                          >
                            ${item.totalCollected.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-xs",
                              item.dueStatus === "vencido"
                                ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                                : item.dueStatus === "por_vencer"
                                  ? "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800"
                                  : "bg-muted text-muted-foreground border-border",
                            )}>
                              {item.nextDueDate.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              {monthsCovered === activeMonths.length &&
                              activeMonths.length > 0 ? (
                                <CheckCircle2 className="w-3 h-3 text-green-600" />
                              ) : (
                                <Clock className="w-3 h-3 text-muted-foreground" />
                              )}
                              {monthsCovered}/{activeMonths.length}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <MaintenanceRowActions
                              service={item}
                              clients={clients}
                              onLoadingChange={(l) => {
                                setLoadingRows((prev) => {
                                  const next = new Set(prev);
                                  if (l) next.add(item.serviceId); else next.delete(item.serviceId);
                                  return next;
                                });
                              }}
                            />
                          </TableCell>
                        </>
                      )}
                    </TableRow>

                    {expandedRows[item.serviceId] && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30 animate-expand-in">
                        <TableCell colSpan={8} className="p-0">
                          <div className="p-4 pl-12">
                            <h4 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                              Detalle Mensual
                            </h4>
                            <div className="gap-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                              {/* Months outside the service lifecycle */}
                              {months
                                .filter(
                                  (m) =>
                                    !isServiceActiveInMonth(
                                      { startDate: item.startDate, endDate: item.endDate },
                                      m.id,
                                    ),
                                )
                                .map((m, idx) => (
                                  <div
                                    key={`inactive-${idx}`}
                                    className="flex flex-col items-center p-3 border border-dashed border-border/50 rounded-md text-sm text-center opacity-40"
                                  >
                                    <span className="mb-1 font-medium text-muted-foreground">{m.label}</span>
                                    <span className="text-muted-foreground/60 text-xs">No activo</span>
                                  </div>
                                ))}
                              {details.map((d, idx) => {
                                const monthTransactions = item.transactionsByMonth[d.id] || [];

                                return (
                                <div
                                  key={idx}
                                  onClick={() => setMonthModal({
                                    serviceId: item.serviceId,
                                    serviceName: item.serviceName,
                                    serviceType: item.serviceType,
                                    monthlyFee: item.monthlyFee,
                                    monthId: d.id,
                                    monthLabel: d.label,
                                    paid: d.paid,
                                    isCovered: d.isCovered,
                                    transactions: monthTransactions,
                                  })}
                                  className={cn(
                                    "flex flex-col items-center p-3 border rounded-md text-sm text-center transition-all cursor-pointer hover:ring-1 hover:ring-ring",
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
                                  {monthTransactions.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground mt-1">
                                      {monthTransactions.length} pago{monthTransactions.length !== 1 ? "s" : ""}
                                    </span>
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

      {/* Month Detail Modal */}
      <Dialog open={!!monthModal} onOpenChange={(open) => !open && setMonthModal(null)}>
        <DialogContent className="sm:max-w-md">
          {monthModal && (() => {
            const isPayment = monthModal.serviceType === "payment";
            const remaining = monthModal.monthlyFee - monthModal.paid;
            const canGenerate = !monthModal.isCovered;
            const cardKey = `${monthModal.serviceId}-${monthModal.monthId}`;
            const isGenerating = generatingKey === cardKey;

            return (
              <>
                <DialogHeader>
                  <DialogTitle>{monthModal.monthLabel}</DialogTitle>
                  <p className="text-sm text-muted-foreground">{monthModal.serviceName}</p>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Amount summary */}
                  <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                    <span className="text-sm text-muted-foreground">{isPayment ? "Pagado" : "Cobrado"}</span>
                    <span className="font-bold text-lg">
                      ${monthModal.paid.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">/ ${monthModal.monthlyFee.toLocaleString()}</span>
                    </span>
                  </div>

                  {/* Due date */}
                  {(() => {
                    // Due date for this month = billingDay of the next month
                    const monthDate = new Date(monthModal.monthId + "-01T12:00:00Z");
                    const dueMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1));
                    const serviceData = data.find((d) => d.serviceId === monthModal.serviceId);
                    const bd = serviceData?.billingDay || 1;
                    const maxDay = new Date(dueMonth.getUTCFullYear(), dueMonth.getUTCMonth() + 1, 0).getDate();
                    const dueDate = new Date(Date.UTC(dueMonth.getUTCFullYear(), dueMonth.getUTCMonth(), Math.min(bd, maxDay), 12, 0, 0, 0));
                    const now = new Date();
                    const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                    const badgeClass = monthModal.isCovered
                      ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                      : diffDays < 0
                        ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                        : diffDays <= 2
                          ? "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800"
                          : "bg-muted text-muted-foreground border-border";
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Fecha Vencimiento</span>
                        <Badge variant="outline" className={cn("text-xs", badgeClass)}>
                          {dueDate.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                        </Badge>
                      </div>
                    );
                  })()}

                  {/* Payment history */}
                  <div className="flex flex-col">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Historial de Pagos
                    </h4>
                    {monthModal.transactions.length === 0 ? (
                      <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
                        Sin pagos registrados
                      </div>
                    ) : (
                      <div className={cn("space-y-2 overflow-y-auto", canGenerate ? "max-h-[200px]" : "max-h-[280px]")}>
                        {monthModal.transactions
                          .sort((a, b) => b.date.getTime() - a.date.getTime())
                          .map((t) => (
                          <div key={t.id} className="flex items-center justify-between p-2 rounded-md border bg-card text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium">{t.description || (isPayment ? "Pago" : "Cobro")}</span>
                              <span className="text-xs text-muted-foreground">
                                {t.date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <span className={cn("font-semibold", isPayment ? "text-red-600" : "text-green-600")}>
                              ${Math.abs(t.amount).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pay remaining button */}
                  {canGenerate && (
                    <Button
                      className="w-full gap-2"
                      disabled={isGenerating}
                      onClick={async () => {
                        await handleAutoGenerate(
                          monthModal.serviceId,
                          monthModal.serviceName,
                          monthModal.serviceType,
                          monthModal.monthlyFee,
                          monthModal.paid,
                          monthModal.monthId,
                          monthModal.monthLabel,
                        );
                        setMonthModal(null);
                      }}
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      {isPayment ? "Pagar" : "Cobrar"} ${remaining.toLocaleString()} restante
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
