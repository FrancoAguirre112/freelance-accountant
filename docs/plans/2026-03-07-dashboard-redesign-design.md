# Dashboard Redesign - Design Document

**Goal:** Transform the minimal 2-chart dashboard into a comprehensive overview with KPI cards, improved charts, and quick-access lists.

## Data Flow

- `DashboardTab` props expand to receive: `data` (transactions, period-scoped), `presupuestos` (all, global), `clients` (all), `services` (all recurring).
- No new DB queries — all data already fetched in `page.tsx`.
- Period-scoped: transactions (filtered by DateRangePicker).
- Global: presupuestos progress, pending amounts, paused indicator.

## Layout (Top to Bottom)

### 1. KPI Cards (Top Row)

Grid: `grid grid-cols-2 lg:grid-cols-4 gap-4`

| Card | Value | Scope | Color |
|------|-------|-------|-------|
| Ingresos | Sum of positive transactions | Period | Green |
| Egresos | Sum of negative transactions (abs) | Period | Red |
| Balance Neto | Income - Expenses | Period | Green if positive, Red if negative |
| Cobro Pendiente | Remaining on active ingreso presupuestos | Global | Neutral/blue |

Below cards: subtle inline note for paused presupuestos if any exist.
Format: "N presupuestos pausados ($X en pausa)" — small muted text with pause icon.

### 2. Charts (Middle)

**Row 1** — `grid md:grid-cols-2 lg:grid-cols-7 gap-4`:
- **Ingresos vs Egresos por Mes** (col-span-4): Existing stacked bar chart. Use `Math.abs()` for egreso bars.
- **Distribución por Categoría** (col-span-3): Existing donut chart, no changes.

**Row 2** — `grid md:grid-cols-2 gap-4`:
- **Top Clientes por Ingreso**: Horizontal bar chart, top 5 clients by income in period. Client name on Y axis, amount on X axis.
- **Progreso de Presupuestos Activos**: List of active presupuestos with mini progress bars (completion %). Sorted by completion desc. Max ~6 items with count note if more. Global scope.

### 3. Quick Lists (Bottom)

**Row 3** — `grid md:grid-cols-2 gap-4`:
- **Últimos Movimientos**: Last 5 transactions in period. Each row: date, entity, amount with color. Mini-table in a Card.
- **Presupuestos por Cobrar**: Active ingreso presupuestos with remaining > 0, sorted by most pending first. Shows: name, client, remaining amount. Max ~5 items. Global scope.

## Paused Presupuestos Handling

- Excluded from all active KPIs (pending, active count, progress list).
- Shown as a subtle inline indicator below KPI cards: count + total paused amount.
- When unpaused, naturally flows back into active metrics.

## Mobile

- All grids collapse to single column.
- KPI cards: `grid-cols-2` on small screens.
- Charts and lists stack vertically.
- No horizontal scrolling.

## Tech

- Recharts 2.15.4 (already installed): BarChart, PieChart, Bar (horizontal via layout="vertical").
- shadcn Card, Badge, Progress components.
- ChartContainer + ChartConfig pattern from existing chart.tsx.
- date-fns for formatting.
