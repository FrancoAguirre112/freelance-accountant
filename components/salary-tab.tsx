"use client";

import * as React from "react";
import {
  format,
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  addHours,
} from "date-fns";
import { es } from "date-fns/locale";
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

interface SalaryMonthData {
  date: Date;
  amount: number;
  target: number;
  percentage: number;
  isCovered: boolean;
}

interface SalaryTabProps {
  from: Date;
  to: Date;
}

export function SalaryTab({ from, to }: SalaryTabProps) {
  const [data, setData] = React.useState<SalaryMonthData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [targetAmount] = React.useState(400);

  React.useEffect(() => {
    async function load() {
      setLoading(true);

      // Generating months.
      // Note: We use the 'from' prop directly. If page.tsx passed a date at 12:00,
      // these will likely be at 12:00 or 00:00 depending on the browser.
      const months = eachMonthOfInterval({
        start: startOfMonth(from),
        end: endOfMonth(to),
      });

      const coverageData = await getSalaryCoverageAction(from, to);

      const formattedData: SalaryMonthData[] = months.map((monthDate) => {
        // Safe comparison for finding data
        // We compare using isSameMonth which is generally robust,
        // but rely on the server response string 'd.month' (ISO)
        const found = coverageData.find((d) =>
          isSameMonth(new Date(d.month), monthDate),
        );

        const currentTarget = found
          ? found.target
          : coverageData.length > 0
            ? coverageData[0].target
            : targetAmount;

        const amount = found ? found.amount : 0;

        return {
          date: monthDate,
          amount,
          target: currentTarget,
          percentage:
            currentTarget > 0
              ? Math.min(100, (amount / currentTarget) * 100)
              : 0,
          isCovered: amount >= currentTarget && currentTarget > 0,
        };
      });

      setData(formattedData);
      setLoading(false);
    }

    load();
  }, [from, to, targetAmount]);

  if (loading) {
    return (
      <div className="py-8 text-muted-foreground text-center">
        Calculando cobertura...
      </div>
    );
  }

  const totalTarget = data.reduce((acc, curr) => acc + curr.target, 0);
  const totalCollected = data.reduce((acc, curr) => acc + curr.amount, 0);
  const totalPercentage =
    totalTarget > 0 ? (totalCollected / totalTarget) * 100 : 0;

  const currentMonthlyTarget =
    data.length > 0 ? data[data.length - 1].target : 0;

  return (
    <div className="space-y-6">
      <div className="gap-4 grid md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              Objetivo Acumulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              ${totalTarget.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">
              Suma de objetivos en el periodo
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              Cobrado Real (Salary)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-green-600 text-2xl">
              ${totalCollected.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">
              Categoría &quot;Sueldo / RTN&quot;
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-2">
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
          <h3 className="font-semibold text-lg">Cobertura de Sueldo (RTN)</h3>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              Objetivo mensual:
            </span>
            <span className="font-bold">
              ${currentMonthlyTarget.toLocaleString()}
            </span>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mes Contable</TableHead>
              <TableHead>Monto Recibido</TableHead>
              <TableHead>Estado de Cobertura</TableHead>
              <TableHead className="text-right">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => {
              // --- TIMEZONE FIX ---
              // Create a safe display date by forcing it to the 15th of the month.
              // This ensures that even if the date is 00:00 and shifts back to the previous day,
              // or matches the previous month, setting it to the middle guarantees the correct month name.
              const safeDate = new Date(row.date);
              safeDate.setDate(15);

              const monthName = format(safeDate, "MMMM yyyy", { locale: es });
              const capitalizedMonth =
                monthName.charAt(0).toUpperCase() + monthName.slice(1);

              const difference = row.amount - row.target;

              return (
                <TableRow key={i}>
                  <TableCell className="font-medium capitalize">
                    {capitalizedMonth}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        row.amount > 0
                          ? "font-bold text-green-700"
                          : "text-muted-foreground"
                      }
                    >
                      ${row.amount.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.isCovered ? "default" : "secondary"}
                      className={
                        row.isCovered
                          ? "bg-green-100 text-green-800 hover:bg-green-200 border-green-200"
                          : "bg-red-50 text-red-800 hover:bg-red-100 border-red-200"
                      }
                    >
                      {row.isCovered ? "Cubierto" : "Pendiente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm text-right">
                    {row.isCovered ? (
                      <span className="flex justify-end items-center gap-1 text-green-600">
                        Superavit: +${difference.toLocaleString()}
                      </span>
                    ) : (
                      <span>
                        Faltan ${Math.abs(difference).toLocaleString()}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
