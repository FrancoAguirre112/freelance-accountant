"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { transactions } from "@/db/schema";
import { type InferSelectModel } from "drizzle-orm";

// 1. Tipado base de la base de datos
type Transaction = InferSelectModel<typeof transactions>;
interface BarDataRow {
  month: string;
  ingreso: number;
  recurring: number;
  egreso: number;
  other: number;
}

interface PieDataRow {
  name: string;
  value: number;
  fill: string;
}

const chartConfig = {
  ingreso: { label: "Ingreso", color: "#4285F4" },
  recurring: { label: "Recurrente", color: "#7E57C2" },
  egreso: { label: "Egreso", color: "#E53935" },
  other: { label: "Otro", color: "#9AA0A6" },
} satisfies ChartConfig;

export function DashboardTab({ data }: { data: Transaction[] }) {
  // Procesamiento de barras con tipado estricto
  const barData = useMemo<BarDataRow[]>(() => {
    const monthsMap: Record<string, BarDataRow> = {};

    data.forEach((t) => {
      const monthName = format(t.date, "MMM yyyy", { locale: es });

      if (!monthsMap[monthName]) {
        monthsMap[monthName] = {
          month: monthName,
          ingreso: 0,
          recurring: 0,
          egreso: 0,
          other: 0,
        };
      }

      if (t.category === "presupuesto") {
        if (t.amount >= 0) monthsMap[monthName].ingreso += t.amount;
        else monthsMap[monthName].egreso += t.amount;
      } else if (t.category === "recurring") {
        monthsMap[monthName].recurring += t.amount;
      } else {
        monthsMap[monthName].other += t.amount;
      }
    });

    return Object.values(monthsMap).sort(
      (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime(),
    );
  }, [data]);

  // Procesamiento de torta con tipado estricto
  const pieData = useMemo<PieDataRow[]>(() => {
    const totals: Record<string, number> = { ingreso: 0, recurring: 0, egreso: 0, other: 0 };

    data.forEach((t) => {
      if (t.category === "presupuesto") {
        if (t.amount >= 0) totals.ingreso += t.amount;
        else totals.egreso += Math.abs(t.amount);
      } else if (t.category === "recurring") {
        totals.recurring += t.amount;
      } else {
        totals.other += t.amount;
      }
    });

    return [
      { name: "Ingresos", value: totals.ingreso, fill: chartConfig.ingreso.color },
      { name: "Recurrente", value: totals.recurring, fill: chartConfig.recurring.color },
      { name: "Egresos", value: totals.egreso, fill: chartConfig.egreso.color },
      { name: "Otros", value: totals.other, fill: chartConfig.other.color },
    ].filter((item) => item.value > 0);
  }, [data]);

  return (
    <div className="gap-4 grid md:grid-cols-2 lg:grid-cols-7 w-full">
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Ingresos Reales por Mes</CardTitle>
          <CardDescription>
            Visualización basada en fechas de cobro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="w-full h-[300px]">
            <BarChart data={barData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="ingreso"
                fill={chartConfig.ingreso.color}
                stackId="a"
              />
              <Bar
                dataKey="recurring"
                fill={chartConfig.recurring.color}
                stackId="a"
              />
              <Bar
                dataKey="egreso"
                fill={chartConfig.egreso.color}
                stackId="b"
              />
              <Bar
                dataKey="other"
                fill={chartConfig.other.color}
                stackId="a"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Distribución de Ingresos</CardTitle>
          <CardDescription>Total acumulado en el período</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="w-full h-[300px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                strokeWidth={5}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
