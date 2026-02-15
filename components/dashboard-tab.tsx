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
type CategoryKey = "project" | "salary" | "maintenance" | "other";

// 2. Interfaces para los datos de los gráficos
interface BarDataRow {
  month: string;
  project: number;
  maintenance: number;
  salary: number;
  other: number;
}

interface PieDataRow {
  name: string;
  value: number;
  fill: string;
}

const chartConfig = {
  maintenance: { label: "Mantenimiento", color: "#7E57C2" }, // Violeta
  project: { label: "Proyecto", color: "#4285F4" }, // Azul
  salary: { label: "Sueldo Fijo", color: "#0F9D58" }, // Verde
  other: { label: "Otro", color: "#9AA0A6" }, // Gris
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
          maintenance: 0,
          salary: 0,
          other: 0,
        };
      }

      const cat = t.category as CategoryKey;
      // Sumamos al acumulador asegurando que la categoría sea válida
      if (cat in monthsMap[monthName]) {
        monthsMap[monthName][cat] += t.amount;
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
      maintenance: 0,
      salary: 0,
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
        name: "Mantenimiento",
        value: totals.maintenance,
        fill: chartConfig.maintenance.color,
      },
      { name: "Sueldo", value: totals.salary, fill: chartConfig.salary.color },
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
                dataKey="maintenance"
                fill={chartConfig.maintenance.color}
                stackId="a"
              />
              <Bar
                dataKey="salary"
                fill={chartConfig.salary.color}
                stackId="a"
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
