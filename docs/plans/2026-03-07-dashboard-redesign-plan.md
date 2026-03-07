# Dashboard Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the minimal 2-chart dashboard into a comprehensive overview with KPI cards, improved charts, and quick-access lists.

**Architecture:** Expand `DashboardTab` props to receive presupuestos, clients, and services alongside transactions. Build 4 visual sections top-to-bottom: KPI cards, existing charts (improved), new charts (top clients + presupuesto progress), and quick lists. Period-scoped data for transactions, global data for presupuestos.

**Tech Stack:** React 19, Next.js App Router, Recharts 2.15.4, shadcn/ui (Card, Badge, Progress), date-fns, Tailwind CSS.

---

### Task 1: Expand DashboardTab Props

**Files:**
- Modify: `app/page.tsx:170-172`
- Modify: `components/dashboard-tab.tsx:28-54`

**Step 1: Update DashboardTab props interface**

In `components/dashboard-tab.tsx`, add imports and expand the component props:

```typescript
// Add to existing imports
import { presupuestos as presupuestosSchema, clients as clientsSchema, recurringServices } from "@/db/schema";

// Add type aliases after existing Transaction type (line ~32)
type Presupuesto = InferSelectModel<typeof presupuestosSchema> & {
  client: InferSelectModel<typeof clientsSchema> | null;
  transactions: Transaction[];
};
type Client = InferSelectModel<typeof clientsSchema>;
type Service = InferSelectModel<typeof recurringServices> & {
  client: Client | null;
};

// Update component signature
export function DashboardTab({
  data,
  presupuestos,
  clients,
  services,
}: {
  data: Transaction[];
  presupuestos: Presupuesto[];
  clients: Client[];
  services: Service[];
})
```

**Step 2: Pass new props from page.tsx**

In `app/page.tsx`, update the DashboardTab usage (line ~171):

```tsx
<DashboardTab
  data={allTransactions}
  presupuestos={allPresupuestos}
  clients={allClients}
  services={allServices}
/>
```

**Step 3: Verify the app compiles**

Run: `pnpm dev`
Expected: No TypeScript errors, dashboard renders same as before.

**Step 4: Commit**

```bash
git add app/page.tsx components/dashboard-tab.tsx
git commit -m "feat(dashboard): expand DashboardTab props with presupuestos, clients, services"
```

---

### Task 2: KPI Summary Cards

**Files:**
- Modify: `components/dashboard-tab.tsx`

**Step 1: Add KPI data computation**

Add a `useMemo` block after the existing `pieData` memo (~line 108) that computes:

```typescript
const kpis = useMemo(() => {
  const totalIncome = data
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = data
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const activeIngreso = presupuestos.filter(
    (p) => p.type === "ingreso" && p.status === "activo"
  );
  const pendingCollection = activeIngreso.reduce((s, p) => {
    const paid = p.transactions.reduce((a, t) => a + Math.abs(t.amount), 0);
    return s + Math.max(p.totalAmount - paid, 0);
  }, 0);

  const paused = presupuestos.filter((p) => p.status === "pausado");
  const pausedAmount = paused.reduce((s, p) => s + p.totalAmount, 0);

  return { totalIncome, totalExpense, balance, pendingCollection, paused, pausedAmount };
}, [data, presupuestos]);
```

**Step 2: Add KPI cards JSX**

Replace the opening `<div>` in the return (the grid wrapper) with a new layout. The full return becomes:

```tsx
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

    {/* Existing charts go here — move the current grid below */}
    <div className="gap-4 grid md:grid-cols-2 lg:grid-cols-7 w-full">
      {/* ... existing bar chart card (col-span-4) ... */}
      {/* ... existing pie chart card (col-span-3) ... */}
    </div>
  </div>
);
```

**Step 3: Verify visually**

Run: `pnpm dev`
Expected: 4 KPI cards at top, paused indicator if applicable, existing charts below.

**Step 4: Commit**

```bash
git add components/dashboard-tab.tsx
git commit -m "feat(dashboard): add KPI summary cards and paused presupuestos indicator"
```

---

### Task 3: Top Clients by Income Chart

**Files:**
- Modify: `components/dashboard-tab.tsx`

**Step 1: Compute top clients data**

Add a `useMemo` after the `kpis` memo:

```typescript
const topClientsData = useMemo(() => {
  const clientIncome: Record<string, { name: string; total: number }> = {};

  data.forEach((t) => {
    if (t.amount <= 0) return;
    const clientName =
      (t as any).presupuesto?.client?.name ||
      (t as any).service?.client?.name ||
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
```

Note: The `data` prop contains transactions with `presupuesto` and `service` relations (joined in `page.tsx`), but the base `Transaction` type doesn't include them. We cast via `as any` since the actual runtime data has these relations. Alternatively, update the `Transaction` type to include optional relations — but keeping it simple.

**Step 2: Add horizontal bar chart**

Add a new row after the existing charts grid, inside the outer `space-y-4` div:

```tsx
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
          <BarChart data={topClientsData} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={75} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="total" fill={topClientsConfig.total.color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </CardContent>
  </Card>

  {/* Placeholder for Task 4 — Presupuesto Progress */}
</div>
```

**Step 3: Add YAxis import**

At the top of the file, add `YAxis` to the recharts import:

```typescript
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
```

**Step 4: Verify visually**

Run: `pnpm dev`
Expected: Horizontal bar chart showing top 5 clients below existing charts.

**Step 5: Commit**

```bash
git add components/dashboard-tab.tsx
git commit -m "feat(dashboard): add top clients by income horizontal bar chart"
```

---

### Task 4: Active Presupuestos Progress

**Files:**
- Modify: `components/dashboard-tab.tsx`

**Step 1: Compute presupuesto progress data**

Add a `useMemo` after `topClientsData`:

```typescript
const presupuestoProgress = useMemo(() => {
  return presupuestos
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
}, [presupuestos]);

const totalActivePresupuestos = presupuestos.filter((p) => p.status === "activo").length;
```

**Step 2: Add progress list card**

Replace the placeholder comment from Task 3 with:

```tsx
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
```

**Step 3: Add Progress import**

```typescript
import { Progress } from "@/components/ui/progress";
```

**Step 4: Verify visually**

Run: `pnpm dev`
Expected: Progress list with bars showing completion % next to the top clients chart.

**Step 5: Commit**

```bash
git add components/dashboard-tab.tsx
git commit -m "feat(dashboard): add active presupuestos progress list"
```

---

### Task 5: Quick Lists (Recent Transactions + Pending Collection)

**Files:**
- Modify: `components/dashboard-tab.tsx`

**Step 1: Compute quick list data**

Add two `useMemo` blocks:

```typescript
const recentTransactions = useMemo(() => {
  return [...data]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
}, [data]);

const pendingPresupuestos = useMemo(() => {
  return presupuestos
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
}, [presupuestos]);
```

**Step 2: Add quick list cards**

Add a new grid row after the Row 2 div:

```tsx
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
              (t as any).presupuesto?.client?.name ||
              (t as any).service?.client?.name ||
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
```

**Step 3: Verify visually**

Run: `pnpm dev`
Expected: Two cards at the bottom — recent transactions on the left, pending presupuestos on the right.

**Step 4: Commit**

```bash
git add components/dashboard-tab.tsx
git commit -m "feat(dashboard): add recent transactions and pending collection quick lists"
```

---

### Task 6: Update Transaction Type for Relations

**Files:**
- Modify: `components/dashboard-tab.tsx:32`

**Step 1: Extend Transaction type to include relations**

Replace the basic `Transaction` type with one that includes the relations actually passed from `page.tsx`:

```typescript
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
```

Then remove all `(t as any)` casts from Tasks 3 and 5, replacing with proper typed access:

- `(t as any).presupuesto?.client?.name` → `t.presupuesto?.client?.name`
- `(t as any).service?.client?.name` → `t.service?.client?.name`

**Step 2: Verify the app compiles**

Run: `pnpm dev`
Expected: No TypeScript errors, all dashboard sections render correctly.

**Step 3: Commit**

```bash
git add components/dashboard-tab.tsx
git commit -m "refactor(dashboard): type transaction relations properly, remove any casts"
```
