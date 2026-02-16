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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getSalaryCoverageAction } from "@/app/actions";
import { getSafeMonthsInRange } from "@/lib/date-utils"; // Import helper

interface SalaryTabProps {
  from: Date;
  to: Date;
}

export function SalaryTab({ from, to }: SalaryTabProps) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      const serverData = await getSalaryCoverageAction(from, to);
      setData(serverData);
      setLoading(false);
    }
    load();
  }, [from, to]);

  if (loading || !data) {
    return (
      <div className="py-8 text-muted-foreground text-center">
        Calculando...
      </div>
    );
  }

  // 1. Generate Safe Months locally
  const months = getSafeMonthsInRange(from, to);

  // 2. Map data
  const tableRows = months.map((m) => {
    // Match by ID "2026-01"
    const amount = data.data[m.id] || 0;
    const target = data.monthlyTarget;
    const isCovered = amount >= target && target > 0;
    const difference = amount - target;

    return {
      ...m,
      amount,
      target,
      isCovered,
      difference,
    };
  });

  // Calculate totals
  const totalTarget = data.monthlyTarget * months.length;
  const totalCollected = tableRows.reduce((acc, curr) => acc + curr.amount, 0);
  const totalPercentage =
    totalTarget > 0 ? (totalCollected / totalTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="gap-4 grid md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">
              Objetivo Acumulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              ${totalTarget.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">Cobrado Real</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-green-600 text-2xl">
              ${totalCollected.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">
              Cobertura Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {totalPercentage.toFixed(1)}%
            </div>
            <Progress value={totalPercentage} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      <div className="bg-white border rounded-md">
        <div className="flex justify-between items-center bg-gray-50 p-4 border-b">
          <h3 className="font-semibold">Cobertura Mensual</h3>
          <span className="text-sm">
            Objetivo: <strong>${data.monthlyTarget}</strong>
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mes</TableHead>
              <TableHead>Recibido</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell
                  className={
                    row.amount > 0
                      ? "font-bold text-green-700"
                      : "text-muted-foreground"
                  }
                >
                  ${row.amount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={row.isCovered ? "default" : "secondary"}
                    className={
                      row.isCovered
                        ? "bg-green-100 text-green-800"
                        : "bg-red-50 text-red-800"
                    }
                  >
                    {row.isCovered ? "Cubierto" : "Pendiente"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm text-right">
                  {row.isCovered ? (
                    <span className="text-green-600">
                      Superavit: +${row.difference}
                    </span>
                  ) : (
                    <span>Faltan ${Math.abs(row.difference)}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
