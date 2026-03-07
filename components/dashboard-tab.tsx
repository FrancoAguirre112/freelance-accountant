"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
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
import { Progress } from "@/components/ui/progress";
import { transactions, presupuestos, clients, recurringServices } from "@/db/schema";
import { type InferSelectModel } from "drizzle-orm";

// 1. Tipado base de la base de datos
type BaseTransaction = InferSelectModel<typeof transactions>;
type Transaction = BaseTransaction & {
  presupuesto?: {
    name: string;
    type: string;
    client?: { name: string } | null;
  } | null;
  service?: {
    name: string;
    client?: { name: string } | null;
  } | null;
};
type Client = InferSelectModel<typeof clients>;
type Presupuesto = InferSelectModel<typeof presupuestos> & {
  client: Client | null;
  transactions: Transaction[];
};
type Service = InferSelectModel<typeof recurringServices> & {
  client: Client | null;
};
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

export function DashboardTab({
  data,
  presupuestos: presupuestosData,
  clients: clientsData,
  services,
}: {
  data: Transaction[];
  presupuestos: Presupuesto[];
  clients: Client[];
  services: Service[];
}) {
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

  const kpis = useMemo(() => {
    const totalIncome = data
      .filter((t) => t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    const totalExpense = data
      .filter((t) => t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const balance = totalIncome - totalExpense;

    const activeIngreso = presupuestosData.filter(
      (p) => p.type === "ingreso" && p.status === "activo"
    );
    const pendingCollection = activeIngreso.reduce((s, p) => {
      const paid = p.transactions.reduce((a, t) => a + Math.abs(t.amount), 0);
      return s + Math.max(p.totalAmount - paid, 0);
    }, 0);

    const paused = presupuestosData.filter((p) => p.status === "pausado");
    const pausedAmount = paused.reduce((s, p) => s + p.totalAmount, 0);

    return { totalIncome, totalExpense, balance, pendingCollection, paused, pausedAmount };
  }, [data, presupuestosData]);

  const topClientsData = useMemo(() => {
    const clientIncome: Record<string, { name: string; total: number }> = {};

    data.forEach((t) => {
      if (t.amount <= 0) return;
      const clientName =
        t.presupuesto?.client?.name ||
        t.service?.client?.name ||
        "Sin Entidad";
      if (!clientIncome[clientName]) {
        clientIncome[clientName] = { name: clientName, total: 0 };
      }
      clientIncome[clientName].total += t.amount;
    });

    return Object.values(clientIncome)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [data]);

  const topClientsConfig = {
    total: { label: "Ingreso", color: "#4285F4" },
  } satisfies ChartConfig;

  const presupuestoProgress = useMemo(() => {
    return presupuestosData
      .filter((p) => p.status === "activo")
      .map((p) => {
        const paid = p.transactions.reduce((a, t) => a + Math.abs(t.amount), 0);
        const progress = p.totalAmount > 0 ? Math.min((paid / p.totalAmount) * 100, 100) : 0;
        return {
          id: p.id,
          name: p.name,
          clientName: p.client?.name || "Sin Entidad",
          type: p.type,
          totalAmount: p.totalAmount,
          paid,
          progress,
        };
      })
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 6);
  }, [presupuestosData]);

  const totalActivePresupuestos = presupuestosData.filter((p) => p.status === "activo").length;

  const recentTransactions = useMemo(() => {
    return [...data]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [data]);

  const pendingPresupuestos = useMemo(() => {
    return presupuestosData
      .filter((p) => p.type === "ingreso" && p.status === "activo")
      .map((p) => {
        const paid = p.transactions.reduce((a, t) => a + Math.abs(t.amount), 0);
        const remaining = Math.max(p.totalAmount - paid, 0);
        return {
          id: p.id,
          name: p.name,
          clientName: p.client?.name || "Sin Entidad",
          remaining,
        };
      })
      .filter((p) => p.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, 5);
  }, [presupuestosData]);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              ${kpis.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Ingresos del Período</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              ${kpis.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Egresos del Período</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className={`text-2xl font-bold ${kpis.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {kpis.balance >= 0 ? "" : "- "}${Math.abs(kpis.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Balance Neto</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              ${kpis.pendingCollection.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Cobro Pendiente</p>
          </CardContent>
        </Card>
      </div>

      {/* Paused presupuestos indicator */}
      {kpis.paused.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
          {kpis.paused.length} presupuesto{kpis.paused.length !== 1 ? "s" : ""} pausado{kpis.paused.length !== 1 ? "s" : ""} (${kpis.pausedAmount.toLocaleString()} en pausa)
        </p>
      )}

      {/* Existing charts */}
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

      {/* Row 2: Top Clients + Presupuesto Progress */}
      <div className="gap-4 grid md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Clientes por Ingreso</CardTitle>
            <CardDescription>Principales clientes en el período</CardDescription>
          </CardHeader>
          <CardContent>
            {topClientsData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay ingresos en este período.
              </p>
            ) : (
              <ChartContainer config={topClientsConfig} className="w-full h-[250px]">
                <BarChart data={topClientsData} layout="vertical">
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} hide />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill={topClientsConfig.total.color} radius={[0, 4, 4, 0]}>
                    {topClientsData.map((entry) => (
                      <Cell key={entry.name} />
                    ))}
                    <LabelList dataKey="name" position="insideLeft" fill="#fff" fontSize={12} fontWeight={500} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progreso de Presupuestos</CardTitle>
            <CardDescription>
              {totalActivePresupuestos} presupuesto{totalActivePresupuestos !== 1 ? "s" : ""} activo{totalActivePresupuestos !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {presupuestoProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay presupuestos activos.
              </p>
            ) : (
              <div className="space-y-3">
                {presupuestoProgress.map((p) => (
                  <div key={p.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <div>
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground text-xs ml-2">{p.clientName}</span>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        ${p.paid.toLocaleString()} / ${p.totalAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={p.progress} className="h-2 flex-1" />
                      <span className="text-[10px] text-muted-foreground w-8 text-right">
                        {p.progress.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
                {totalActivePresupuestos > 6 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{totalActivePresupuestos - 6} más
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recent Transactions + Pending Collection */}
      <div className="gap-4 grid md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Últimos Movimientos</CardTitle>
            <CardDescription>Transacciones recientes del período</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay movimientos en este período.
              </p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((t) => {
                  const isExpense = t.amount < 0;
                  const clientName =
                    t.presupuesto?.client?.name ||
                    t.service?.client?.name ||
                    "Sin Entidad";
                  return (
                    <div key={t.id} className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{clientName}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(t.date, "dd/MM/yyyy", { locale: es })}
                        </span>
                      </div>
                      <span className={`text-sm font-bold ${isExpense ? "text-red-600" : "text-green-600"}`}>
                        {isExpense ? "- " : "+ "}${Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Presupuestos por Cobrar</CardTitle>
            <CardDescription>Ingresos pendientes de cobro</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingPresupuestos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay presupuestos pendientes de cobro.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingPresupuestos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.clientName}</span>
                    </div>
                    <span className="text-sm font-bold text-blue-600">
                      ${p.remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
