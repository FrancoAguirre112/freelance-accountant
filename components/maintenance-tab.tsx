"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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
import { cn } from "@/lib/utils";

interface MaintenanceTabProps {
  from: Date;
  to: Date;
}

function StatusBadge({ covered, total }: { covered: number; total: number }) {
  if (covered === total && total > 0) {
    return (
      <Badge className="gap-1 bg-green-100 hover:bg-green-100 border-green-200 text-green-700">
        <CheckCircle2 className="w-3 h-3" /> Completo ({covered}/{total})
      </Badge>
    );
  }
  if (covered === 0) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Clock className="w-3 h-3" /> Pendiente ({covered}/{total})
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="gap-1 bg-yellow-100 hover:bg-yellow-100 border-yellow-200 text-yellow-800"
    >
      <AlertCircle className="w-3 h-3" /> Parcial ({covered}/{total})
    </Badge>
  );
}

export function MaintenanceTab({ from, to }: MaintenanceTabProps) {
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedRows, setExpandedRows] = React.useState<
    Record<number, boolean>
  >({});

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getMaintenanceCoverageAction(from, to);
      setData(res);
      setLoading(false);
    }
    load();
  }, [from, to]);

  const toggleRow = (serviceId: number) => {
    setExpandedRows((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }));
  };

  if (loading) {
    return (
      <div className="py-12 text-muted-foreground text-center">
        Cargando estado de mantenimientos...
      </div>
    );
  }

  const totalExpected = data.reduce((acc, curr) => acc + curr.totalTarget, 0);
  const totalCollected = data.reduce(
    (acc, curr) => acc + curr.totalCollected,
    0,
  );
  const totalPercentage =
    totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="gap-4 grid md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="font-bold text-2xl">
              ${totalExpected.toLocaleString()}
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-muted-foreground text-center"
                >
                  No hay servicios de mantenimiento activos.
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <React.Fragment key={item.serviceId}>
                  {/* FILA PRINCIPAL */}
                  <TableRow
                    className={cn(
                      "hover:bg-muted/50 transition-colors cursor-pointer",
                      expandedRows[item.serviceId] && "bg-muted/50 border-b-0",
                    )}
                    onClick={() => toggleRow(item.serviceId)}
                  >
                    <TableCell>
                      <Button variant="ghost" size="icon" className="w-6 h-6">
                        {expandedRows[item.serviceId] ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.clientName}</span>
                        <span className="text-muted-foreground text-xs">
                          {item.serviceName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>${item.monthlyFee}</TableCell>
                    <TableCell>
                      <span
                        className={
                          item.totalCollected >= item.totalTarget
                            ? "text-green-600 font-medium"
                            : ""
                        }
                      >
                        ${item.totalCollected.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        covered={item.monthsCovered}
                        total={item.totalMonths}
                      />
                    </TableCell>
                  </TableRow>

                  {/* DETALLE EXPANDIDO */}
                  {expandedRows[item.serviceId] && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={5} className="p-0">
                        <div className="gap-2 grid p-4 pl-12">
                          <h4 className="mb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                            Detalle Mensual
                          </h4>
                          <div className="gap-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                            {item.details.map((month: any, idx: number) => {
                              // --- FIX DE VISUALIZACIÓN ---
                              // 1. Convertimos string a Objeto Fecha
                              const dateObj = new Date(month.date);
                              // 2. Le ponemos 12:00 del mediodía para evitar saltos de día por zona horaria
                              dateObj.setHours(12);
                              // 3. Formateamos
                              const monthName = format(dateObj, "MMM yyyy", {
                                locale: es,
                              });

                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    "flex flex-col items-center p-3 border rounded-md text-sm text-center transition-all",
                                    month.status === "paid"
                                      ? "bg-green-50 border-green-200"
                                      : month.status === "partial"
                                        ? "bg-yellow-50 border-yellow-200"
                                        : "bg-white border-gray-200",
                                  )}
                                >
                                  <span className="mb-1 font-medium capitalize">
                                    {monthName}
                                  </span>
                                  {month.status === "paid" ? (
                                    <span className="flex items-center gap-1 font-bold text-green-700 text-xs">
                                      <CheckCircle2 className="w-3 h-3" />{" "}
                                      Pagado
                                    </span>
                                  ) : month.status === "partial" ? (
                                    <span className="font-bold text-yellow-700 text-xs">
                                      ${month.paid} / ${month.target}
                                    </span>
                                  ) : (
                                    <span className="font-medium text-red-400 text-xs">
                                      Pendiente
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
