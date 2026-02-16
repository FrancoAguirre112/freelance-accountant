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

interface MaintenanceTabProps {
  from: Date;
  to: Date;
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

  const toggleRow = (id: number) =>
    setExpandedRows((p) => ({ ...p, [id]: !p[id] }));

  if (loading) return <div className="py-12 text-center">Cargando...</div>;

  // Generate Safe Months
  const months = getSafeMonthsInRange(from, to);

  // Calculate Aggregates
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
      {/* (Cards for Stats here - same as before) */}

      <div className="bg-white border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            {/* (Headers same as before) */}
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Abono</TableHead>
              <TableHead>Cobrado</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => {
              // Calculate coverage based on our safe months
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
                      "hover:bg-muted/50 cursor-pointer",
                      expandedRows[item.serviceId] && "bg-muted/50 border-b-0",
                    )}
                    onClick={() => toggleRow(item.serviceId)}
                  >
                    <TableCell>
                      <ChevronRight className="w-4 h-4" />
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
                    <TableCell
                      className={
                        item.totalCollected >= item.monthlyFee * months.length
                          ? "text-green-600"
                          : ""
                      }
                    >
                      ${item.totalCollected}
                    </TableCell>
                    <TableCell>
                      {/* Custom Badge Logic */}
                      <Badge variant="outline">
                        {monthsCovered}/{months.length}
                      </Badge>
                    </TableCell>
                  </TableRow>

                  {expandedRows[item.serviceId] && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={5} className="p-0">
                        <div className="p-4 pl-12">
                          <div className="gap-3 grid grid-cols-6">
                            {details.map((d) => (
                              <div
                                key={d.id}
                                className={cn(
                                  "p-3 border rounded text-sm text-center",
                                  d.isCovered
                                    ? "bg-green-50 border-green-200"
                                    : "bg-white",
                                )}
                              >
                                <div className="mb-1 font-medium">
                                  {d.label}
                                </div>
                                {d.isCovered ? (
                                  <span className="font-bold text-green-700 text-xs">
                                    Pagado
                                  </span>
                                ) : (
                                  <span className="text-red-400 text-xs">
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
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
