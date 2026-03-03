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
type CategoryKey = "project" | "recurring" | "pago" | "other";

interface BarDataRow {
  month: string;
  project: number;
  recurring: number;
  pago: number;
  other: number;
}

interface PieDataRow {
  name: string;
  value: number;
  fill: string;
}

const chartConfig = {
  project: { label: "Proyecto", color: "#4285F4" },
  recurring: { label: "Recurrente", color: "#7E57C2" },
  pago: { label: "Pago", color: "#E53935" },
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
          project: 0,
          recurring: 0,
          pago: 0,
          other: 0,
        };
      }

      const cat = t.category as CategoryKey;
      if (cat in monthsMap[monthName]) {
        monthsMap[monthName][cat] += cat === "pago" ? -t.amount : t.amount;
      }
    });

    return Object.values(monthsMap).sort(
      (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime(),
    );
  }, [data]);

  // Procesamiento de torta con tipado estricto
  const pieData = useMemo<PieDataRow[]>(() => {
    const totals: Record<CategoryKey, number> = {
      project: 0,
      recurring: 0,
      pago: 0,
      other: 0,
    };

    data.forEach((t) => {
      const cat = t.category as CategoryKey;
      if (totals[cat] !== undefined) {
        totals[cat] += t.amount;
      }
    });

    return [
      {
        name: "Proyectos",
        value: totals.project,
        fill: chartConfig.project.color,
      },
      {
        name: "Recurrente",
        value: totals.recurring,
        fill: chartConfig.recurring.color,
      },
      {
        name: "Pagos",
        value: totals.pago,
        fill: chartConfig.pago.color,
      },
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
                dataKey="project"
                fill={chartConfig.project.color}
                stackId="a"
              />
              <Bar
                dataKey="recurring"
                fill={chartConfig.recurring.color}
                stackId="a"
              />
              <Bar
                dataKey="pago"
                fill={chartConfig.pago.color}
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
