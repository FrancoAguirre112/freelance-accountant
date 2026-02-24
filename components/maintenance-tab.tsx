"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
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
import { getMaintenanceCoverageAction } from "@/app/actions";
import { getSafeMonthsInRange } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { MaintenanceRowActions } from "@/components/maintenance-row-actions";
import { type InferSelectModel } from "drizzle-orm";
import { clients, transactions, recurringServices } from "@/db/schema";

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

  const toggleRow = (id: number) =>
    setExpandedRows((p) => ({ ...p, [id]: !p[id] }));

  // Synchronous calculation
  const maintenanceServices = services.filter((s) => s.type === "maintenance");
  
  const relatedTransactions = transactions.filter(
    (t) =>
      t.category === "maintenance" &&
      t.date >= new Date(from.setUTCHours(0, 0, 0, 0)) &&
      t.date <= new Date(to.setUTCHours(23, 59, 59, 999))
  );

  const data = maintenanceServices.map((service) => {
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
      clientId: service.clientId,
      clientName: service.client?.name || "Sin Cliente",
      monthlyFee: service.amount,
      totalCollected,
      paymentsByMonth,
    };
  });

  // Stats Logic
  const months = getSafeMonthsInRange(from, to);
  const totalTarget = data.reduce(
    (acc, curr) => acc + curr.monthlyFee * months.length,
    0,
  );
  const totalCollected = data.reduce(
    (acc, curr) => acc + curr.totalCollected,
    0,
  );
  const totalPercentage =
    totalTarget > 0 ? (totalCollected / totalTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="gap-4 grid md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="font-bold text-2xl">
              ${totalTarget.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">
              Potencial en el periodo
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="font-bold text-green-600 text-2xl">
              ${totalCollected.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">Cobrado Real</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="font-bold text-2xl">
              {totalPercentage.toFixed(1)}%
            </div>
            <p className="text-muted-foreground text-xs">
              Efectividad de Cobro
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Cliente / Servicio</TableHead>
              <TableHead>Abono Mensual</TableHead>
              <TableHead>Cobrado (Rango)</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[50px]"></TableHead>{" "}
              {/* Columna para Acciones */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-muted-foreground text-center"
                >
                  No hay servicios de mantenimiento activos.
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => {
                let monthsCovered = 0;
                const details = months.map((m) => {
                  const paid = item.paymentsByMonth[m.id] || 0;
                  const isCovered = paid >= item.monthlyFee;
                  if (isCovered) monthsCovered++;
                  return { ...m, paid, isCovered };
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
                      <TableCell>${item.monthlyFee}</TableCell>
                      <TableCell
                        className={
                          item.totalCollected >= item.monthlyFee * months.length
                            ? "text-green-600 font-medium"
                            : ""
                        }
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
                      {/* NUEVA CELDA DE ACCIONES */}
                      <TableCell>
                        <MaintenanceRowActions
                          service={item}
                          clients={clients}
                        />
                      </TableCell>
                    </TableRow>

                    {expandedRows[item.serviceId] && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6} className="p-0">
                          <div className="p-4 pl-12">
                            <h4 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                              Detalle Mensual
                            </h4>
                            <div className="gap-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                              {details.map((d, idx) => (
                                <div
                                  key={idx}
                                  className={cn(
                                    "flex flex-col items-center p-3 border rounded-md text-sm text-center transition-all",
                                    d.isCovered
                                      ? "bg-green-50 border-green-200"
                                      : "bg-white border-gray-200",
                                  )}
                                >
                                  <span className="mb-1 font-medium">
                                    {d.label}
                                  </span>
                                  {d.isCovered ? (
                                    <span className="font-bold text-green-700 text-xs">
                                      Pagado
                                    </span>
                                  ) : (
                                    <span className="font-medium text-red-400 text-xs">
                                      Pendiente
                                    </span>
                                  )}
                                </div>
                              ))}
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
