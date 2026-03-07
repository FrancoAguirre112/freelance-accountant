# Merge Proyectos + Pagos into Presupuestos — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the Proyectos and Pagos tables/tabs into a single "Presupuestos" concept with a type column (ingreso/egreso).

**Architecture:** New `presupuestos` DB table replaces `projects` + `pagos`. Transactions get `presupuestoId` instead of `projectId`/`pagoId`. New unified UI tab. Migration script moves all existing data.

**Tech Stack:** Drizzle ORM, SQLite/Turso, Next.js 16, React 19, shadcn/ui

---

### Task 1: Update DB schema

**Files:**
- Modify: `db/schema.ts`

**Step 1: Replace projects + pagos tables with presupuestos**

In `db/schema.ts`, replace the `projects` and `pagos` table definitions with:

```ts
export const presupuestos = sqliteTable("presupuestos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clients.id),
  name: text("name").notNull(),
  totalAmount: real("total_amount").notNull(),
  type: text("type", { enum: ["ingreso", "egreso"] }).notNull(),
  status: text("status").default("activo"),
}, (table) => [
  index("presupuestos_user_id_idx").on(table.userId),
]);
```

**Step 2: Update transactions table**

Replace `projectId` and `pagoId` with `presupuestoId`:

```ts
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  imputedDate: integer("imputed_date", { mode: "timestamp" }),
  amount: real("amount").notNull(),
  category: text("category", {
    enum: ["presupuesto", "recurring", "other"],
  }).notNull(),
  description: text("description"),
  presupuestoId: integer("presupuesto_id").references(() => presupuestos.id),
  serviceId: integer("service_id").references(() => recurringServices.id),
  status: text("status").default("paid"),
}, (table) => [
  index("transactions_user_id_idx").on(table.userId),
  index("transactions_user_date_idx").on(table.userId, table.date),
]);
```

**Step 3: Update all relations**

Replace `projectsRelations` and `pagosRelations` with:

```ts
export const presupuestosRelations = relations(presupuestos, ({ one, many }) => ({
  user: one(users, { fields: [presupuestos.userId], references: [users.id] }),
  client: one(clients, {
    fields: [presupuestos.clientId],
    references: [clients.id],
  }),
  transactions: many(transactions),
}));
```

Update `usersRelations` — replace `projects: many(projects)` and `pagos: many(pagos)` with `presupuestos: many(presupuestos)`.

Update `clientsRelations` — replace `projects: many(projects)` and `pagos: many(pagos)` with `presupuestos: many(presupuestos)`.

Update `transactionsRelations` — replace the `project` and `pago` relations with:

```ts
presupuesto: one(presupuestos, {
  fields: [transactions.presupuestoId],
  references: [presupuestos.id],
}),
```

Remove all imports/exports of `projects` and `pagos`.

**Step 4: Commit**

```bash
git add db/schema.ts
git commit -m "feat: replace projects+pagos with presupuestos in schema"
```

---

### Task 2: Write migration script

**Files:**
- Create: `scripts/migrate-presupuestos.ts`

This is a raw SQL migration that runs against Turso. It must:

1. Create `presupuestos` table
2. Copy `projects` → presupuestos with type='ingreso', mapping status: `en_desarrollo`→`activo`, `finalizado`→`finalizado`, `pausado`→`pausado`
3. Copy `pagos` → presupuestos with type='egreso', mapping status: `pendiente`→`activo`, `pago_parcial`→`activo`, `saldado`→`finalizado`
4. Add `presupuesto_id` column to transactions
5. Map `project_id` → `presupuesto_id` (using old project id → new presupuesto id)
6. Map `pago_id` → `presupuesto_id` (using old pago id → new presupuesto id)
7. Update transaction categories: `project` and `pago` → `presupuesto`
8. Drop old columns and tables

```ts
import { createClient } from "@libsql/client";
import "dotenv/config";

const url = process.env.TURSO_DATABASE_URL?.replace("libsql://", "https://");
const client = createClient({
  url: url!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log("Starting migration...");

  // 1. Create presupuestos table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS presupuestos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
      client_id INTEGER REFERENCES clients(id),
      name TEXT NOT NULL,
      total_amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ingreso', 'egreso')),
      status TEXT DEFAULT 'activo'
    )
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS presupuestos_user_id_idx ON presupuestos(user_id)
  `);

  console.log("Created presupuestos table");

  // 2. Copy projects → presupuestos (ingreso)
  await client.execute(`
    INSERT INTO presupuestos (id, user_id, client_id, name, total_amount, type, status)
    SELECT id, user_id, client_id, name, total_amount, 'ingreso',
      CASE status
        WHEN 'en_desarrollo' THEN 'activo'
        WHEN 'finalizado' THEN 'finalizado'
        WHEN 'pausado' THEN 'pausado'
        ELSE 'activo'
      END
    FROM projects
  `);

  const projectCount = await client.execute("SELECT COUNT(*) as c FROM projects");
  console.log(`Migrated ${projectCount.rows[0].c} projects as ingresos`);

  // 3. Copy pagos → presupuestos (egreso) with offset IDs to avoid conflicts
  // First get max project id to offset pago ids
  const maxId = await client.execute("SELECT COALESCE(MAX(id), 0) as m FROM presupuestos");
  const offset = Number(maxId.rows[0].m);

  await client.execute(`
    INSERT INTO presupuestos (id, user_id, client_id, name, total_amount, type, status)
    SELECT id + ${offset}, user_id, client_id, name, total_amount, 'egreso',
      CASE status
        WHEN 'pendiente' THEN 'activo'
        WHEN 'pago_parcial' THEN 'activo'
        WHEN 'saldado' THEN 'finalizado'
        ELSE 'activo'
      END
    FROM pagos
  `);

  const pagoCount = await client.execute("SELECT COUNT(*) as c FROM pagos");
  console.log(`Migrated ${pagoCount.rows[0].c} pagos as egresos (offset: ${offset})`);

  // 4. Add presupuesto_id column to transactions
  await client.execute(`
    ALTER TABLE transactions ADD COLUMN presupuesto_id INTEGER REFERENCES presupuestos(id)
  `);

  console.log("Added presupuesto_id column to transactions");

  // 5. Map project_id → presupuesto_id (same id, no offset)
  await client.execute(`
    UPDATE transactions SET presupuesto_id = project_id WHERE project_id IS NOT NULL
  `);

  // 6. Map pago_id → presupuesto_id (with offset)
  await client.execute(`
    UPDATE transactions SET presupuesto_id = pago_id + ${offset} WHERE pago_id IS NOT NULL
  `);

  console.log("Mapped transaction foreign keys");

  // 7. Update categories
  await client.execute(`
    UPDATE transactions SET category = 'presupuesto' WHERE category IN ('project', 'pago')
  `);

  console.log("Updated transaction categories");

  // 8. Drop old columns (SQLite doesn't support DROP COLUMN before 3.35.0,
  //    but Turso uses modern SQLite so this should work)
  await client.execute("ALTER TABLE transactions DROP COLUMN project_id");
  await client.execute("ALTER TABLE transactions DROP COLUMN pago_id");

  console.log("Dropped old FK columns from transactions");

  // 9. Drop old tables
  await client.execute("DROP TABLE IF EXISTS projects");
  await client.execute("DROP TABLE IF EXISTS pagos");

  console.log("Dropped old projects and pagos tables");
  console.log("Migration complete!");
}

migrate().catch(console.error);
```

**Step 2: Commit**

```bash
git add scripts/migrate-presupuestos.ts
git commit -m "feat: add presupuestos migration script"
```

---

### Task 3: Update server actions

**Files:**
- Modify: `app/actions.ts`

**Step 1: Replace all project/pago actions with presupuesto equivalents**

Key changes:
- Remove imports of `projects` and `pagos` from schema. Import `presupuestos` instead.
- Replace `TransactionCategory` type: `"project" | "recurring" | "pago" | "other"` → `"presupuesto" | "recurring" | "other"`
- Replace `createProjectAction` and `createPagoAction` with single `createPresupuestoAction`:

```ts
export async function createPresupuestoAction(data: {
  name: string;
  clientId: number;
  totalAmount: number;
  type: "ingreso" | "egreso";
  status?: string;
}) {
  try {
    const userId = await requireUserId();
    await db.insert(presupuestos).values({
      name: data.name,
      clientId: data.clientId,
      totalAmount: data.totalAmount,
      type: data.type,
      status: data.status || "activo",
      userId,
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}
```

- Replace `updateProjectAction` and `updatePagoAction` with `updatePresupuestoAction`:

```ts
export async function updatePresupuestoAction(
  id: number,
  data: Partial<InferInsertModel<typeof presupuestos>>,
) {
  const userId = await requireUserId();
  await db.update(presupuestos).set(data).where(and(eq(presupuestos.id, id), eq(presupuestos.userId, userId)));
  revalidatePath("/");
  return { success: true };
}
```

- Replace `deleteProjectAction` and `deletePagoAction` with `deletePresupuestoAction`:

```ts
export async function deletePresupuestoAction(id: number) {
  try {
    const userId = await requireUserId();
    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({ presupuestoId: null })
        .where(eq(transactions.presupuestoId, id));
      await tx.delete(presupuestos).where(and(eq(presupuestos.id, id), eq(presupuestos.userId, userId)));
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting presupuesto:", error);
    return { success: false, error: "No se pudo eliminar el presupuesto" };
  }
}
```

- Update `deleteClientAction` to check `presupuestos` instead of `projects`:

```ts
const associatedPresupuestos = await db.query.presupuestos.findFirst({
  where: and(eq(presupuestos.clientId, id), eq(presupuestos.userId, userId)),
});
// ... check associatedPresupuestos instead of associatedProjects
```

- Update `createTransactionAction` — the data type now has `presupuestoId` instead of `projectId`/`pagoId`.

- Update `bulkSmartImportAction`:
  - Replace `projects` and `pagos` data arrays with single `presupuestos` handling
  - The `projectMap` and `pagoMap` become a single `presupuestoMap`
  - Transaction linking uses `presupuestoId` instead of `projectId`/`pagoId`
  - Categories `"project"` and `"pago"` become `"presupuesto"`

- Update `createRecurringPaymentFromPagoAction` — rename to `createRecurringFromPresupuestoAction`, same logic.

- Update `RawImportData` type: merge `projects` and `pagos` arrays into `presupuestos` with a `type` field.

**Step 2: Commit**

```bash
git add app/actions.ts
git commit -m "feat: replace project/pago actions with presupuesto actions"
```

---

### Task 4: Create presupuesto-combobox component

**Files:**
- Create: `components/presupuesto-combobox.tsx`
- Delete: `components/project-combobox.tsx`
- Delete: `components/pago-combobox.tsx`

**Step 1: Create the unified combobox**

Same pattern as `project-combobox.tsx` but for presupuestos:

```tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Presupuesto {
  id: number;
  name: string;
  type: string;
}

interface PresupuestoComboboxProps {
  presupuestos: Presupuesto[];
  name?: string;
  required?: boolean;
  filterType?: "ingreso" | "egreso";
}

export function PresupuestoCombobox({
  presupuestos,
  name,
  required,
  filterType,
}: PresupuestoComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  const filtered = filterType
    ? presupuestos.filter((p) => p.type === filterType)
    : presupuestos;

  const selected = filtered.find((p) => p.id.toString() === value);

  return (
    <div className="flex flex-col w-full">
      <input type="hidden" name={name} value={value} required={required} />
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between w-full font-normal"
          >
            {value ? (
              selected?.name
            ) : (
              <span className="text-muted-foreground">Buscar presupuesto...</span>
            )}
            <ChevronsUpDown className="opacity-50 ml-2 w-4 h-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width]"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Buscar presupuesto..." />
            <CommandList>
              <CommandEmpty>No se encontró.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="none"
                  onSelect={() => {
                    setValue("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 w-4 h-4",
                      value === "" ? "opacity-100" : "opacity-0",
                    )}
                  />
                  Ninguno (Sin vincular)
                </CommandItem>
                {filtered.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.name}
                    onSelect={() => {
                      setValue(p.id.toString());
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 w-4 h-4",
                        value === p.id.toString() ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {p.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/presupuesto-combobox.tsx
git rm components/project-combobox.tsx components/pago-combobox.tsx
git commit -m "feat: add unified PresupuestoCombobox, remove old comboboxes"
```

---

### Task 5: Create presupuestos-tab component

**Files:**
- Create: `components/presupuestos-tab.tsx`
- Delete: `components/projects-tab.tsx`
- Delete: `components/pagos-tab.tsx`

**Step 1: Create the unified tab**

This combines the logic of both tabs. Key differences from the old tabs:
- Type filter (Todos/Ingresos/Egresos) as first filter field
- Amount color determined by type: green for ingreso, red for egreso
- Unified status labels
- Row action type is "presupuesto"

```tsx
"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RowActions } from "./tables/row-actions";
import { type InferSelectModel } from "drizzle-orm";
import { presupuestos, clients, transactions } from "@/db/schema";
import { TabSearch, parseSearch } from "@/components/tab-search";
import { TabFilters, useTabFilters, type FilterField } from "@/components/tab-filters";
import { CsvExportButton } from "@/components/csv-export-button";
import { SortableHeader, useSort } from "@/components/ui/sortable-header";

type Client = InferSelectModel<typeof clients>;
type Transaction = InferSelectModel<typeof transactions>;
type Presupuesto = InferSelectModel<typeof presupuestos> & {
  client: Client | null;
  transactions: Transaction[];
};

const SEARCH_PREFIXES = [{ key: "e", label: "Entidad" }];

export function PresupuestosTab({
  presupuestos,
  clients,
}: {
  presupuestos: Presupuesto[];
  clients: Client[];
}) {
  const [search, setSearch] = useState("");
  const { sort, onSort } = useSort();
  const { values: filters, onChange: onFilterChange, onClear: onFilterClear } = useTabFilters();

  const filterFields: FilterField[] = useMemo(() => [
    { key: "type", label: "Tipo", type: "select", options: [
      { value: "ingreso", label: "Ingresos" },
      { value: "egreso", label: "Egresos" },
    ]},
    { key: "clientId", label: "Entidad", type: "combobox", options: clients.map((c) => ({ value: c.id.toString(), label: c.name })) },
    { key: "status", label: "Estado", type: "select", options: [
      { value: "activo", label: "Activo" },
      { value: "finalizado", label: "Finalizado" },
      { value: "pausado", label: "Pausado" },
    ]},
    { key: "showFinished", label: "Mostrar Finalizados", type: "switch" },
  ], [clients]);

  const processedPresupuestos = useMemo(() => {
    const { field, term } = parseSearch(search, SEARCH_PREFIXES);
    const lower = term.toLowerCase();

    return presupuestos
      .map((p) => {
        const totalPaid = p.transactions.reduce((acc, t) => acc + t.amount, 0);
        return { ...p, totalPaid };
      })
      .filter((p) => {
        if (filters.showFinished !== "true") {
          if (p.status === "finalizado" || p.totalPaid >= p.totalAmount)
            return false;
        }
        if (filters.type && filters.type !== "all" && p.type !== filters.type) return false;
        if (filters.clientId && filters.clientId !== "all" && p.clientId?.toString() !== filters.clientId) return false;
        if (filters.status && filters.status !== "all" && p.status !== filters.status) return false;

        if (!term) return true;
        switch (field) {
          case "e":
            return (p.client?.name || "").toLowerCase().includes(lower);
          default:
            return p.name.toLowerCase().includes(lower);
        }
      });
  }, [presupuestos, filters, search]);

  const sorted = useMemo(() => {
    if (!sort) return processedPresupuestos;
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...processedPresupuestos].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sort.key) {
        case "name": va = a.name; vb = b.name; break;
        case "budget": va = a.totalAmount; vb = b.totalAmount; break;
        case "paid": va = a.totalPaid; vb = b.totalPaid; break;
        case "progress": va = a.totalAmount > 0 ? a.totalPaid / a.totalAmount : 0; vb = b.totalAmount > 0 ? b.totalPaid / b.totalAmount : 0; break;
        case "status": va = a.status || ""; vb = b.status || ""; break;
        default: return 0;
      }
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
      return String(va).localeCompare(String(vb)) * mul;
    });
  }, [processedPresupuestos, sort]);

  const totalBudget = processedPresupuestos.reduce((s, p) => s + p.totalAmount, 0);
  const totalPaidAll = processedPresupuestos.reduce((s, p) => s + p.totalPaid, 0);

  const getExportData = () =>
    processedPresupuestos.map((p) => ({
      Nombre: p.name,
      Tipo: p.type === "ingreso" ? "Ingreso" : "Egreso",
      Entidad: p.client?.name || "",
      "Monto Total": p.totalAmount,
      Cobrado: p.totalPaid,
      Pendiente: p.totalAmount - p.totalPaid,
      Estado: p.status || "",
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TabSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar presupuestos..."
          prefixes={SEARCH_PREFIXES}
          defaultLabel="presupuesto"
        />
        <TabFilters
          fields={filterFields}
          values={filters}
          onChange={onFilterChange}
          onClear={onFilterClear}
        />
        <CsvExportButton getData={getExportData} filename="presupuestos" />
      </div>

      <div className="bg-card border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader label="Nombre / Entidad" sortKey="name" sort={sort} onSort={onSort} />
              <SortableHeader label="Monto Total" sortKey="budget" sort={sort} onSort={onSort} />
              <SortableHeader label="Cobrado" sortKey="paid" sort={sort} onSort={onSort} />
              <SortableHeader label="Progreso" sortKey="progress" sort={sort} onSort={onSort} />
              <SortableHeader label="Estado" sortKey="status" sort={sort} onSort={onSort} className="text-right" />
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => {
              const { totalPaid } = p;
              const isIngreso = p.type === "ingreso";
              const amountColor = isIngreso ? "text-green-600" : "text-red-600";
              const progressPercentage = Math.min(
                (totalPaid / p.totalAmount) * 100,
                100,
              );

              let statusLabel = "Pendiente";
              let statusColor = "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800";

              if (totalPaid >= p.totalAmount) {
                statusLabel = isIngreso ? "Cobrado Total" : "Saldado";
                statusColor = "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800";
              } else if (totalPaid > 0) {
                statusLabel = "Pago Parcial";
                statusColor = "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800";
              }

              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] px-1 py-0 ${isIngreso ? "border-green-300 text-green-600" : "border-red-300 text-red-600"}`}>
                        {isIngreso ? "IN" : "EG"}
                      </Badge>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {p.client?.name}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    ${p.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className={amountColor}>
                    ${totalPaid.toLocaleString()}
                  </TableCell>
                  <TableCell className="w-[200px]">
                    <div className="flex items-center gap-2">
                      <Progress value={progressPercentage} className="h-2 flex-1" />
                      <span className="text-[10px] text-muted-foreground w-8 text-right">
                        {progressPercentage.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={statusColor}>
                      {statusLabel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <RowActions row={p} type="presupuesto" clients={clients} />
                  </TableCell>
                </TableRow>
              );
            })}
          {sorted.length > 0 && (
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell className="text-muted-foreground text-xs uppercase">
                {sorted.length} presupuesto{sorted.length !== 1 ? "s" : ""}
              </TableCell>
              <TableCell>${totalBudget.toLocaleString()}</TableCell>
              <TableCell>
                ${totalPaidAll.toLocaleString()}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress
                    value={totalBudget > 0 ? Math.min((totalPaidAll / totalBudget) * 100, 100) : 0}
                    className="h-2 flex-1"
                  />
                  <span className="text-[10px] text-muted-foreground w-8 text-right">
                    {totalBudget > 0 ? ((totalPaidAll / totalBudget) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              </TableCell>
              <TableCell />
              <TableCell />
            </TableRow>
          )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/presupuestos-tab.tsx
git rm components/projects-tab.tsx components/pagos-tab.tsx
git commit -m "feat: add unified PresupuestosTab, remove old tabs"
```

---

### Task 6: Update row-actions.tsx

**Files:**
- Modify: `components/tables/row-actions.tsx`

**Step 1: Replace project/pago types and actions with presupuesto**

Key changes:
- Import `presupuestos` instead of `projects` and `pagos` from schema
- Replace type aliases: `type Presupuesto = InferSelectModel<typeof presupuestos>;` (remove Project and Pago types)
- Update `RowActionsProps` union: replace `project` and `pago` variants with single `presupuesto` variant:

```ts
| { type: "presupuesto"; row: Presupuesto; clients?: Client[] }
```

- Remove `projects` prop from RowActionsProps (no longer needed)
- Update `handleDelete`: replace `if (type === "project")` and `if (type === "pago")` with `if (type === "presupuesto") res = await deletePresupuestoAction(row.id);`
- Update `handleUpdate`: replace project/pago blocks with single presupuesto block:

```ts
} else if (type === "presupuesto") {
  res = await updatePresupuestoAction(row.id, {
    name: formData.get("name") as string,
    clientId: parseInt(formData.get("clientId") as string),
    totalAmount: parseFloat(formData.get("totalAmount") as string),
    status: formData.get("status") as string,
  });
}
```

- Update `handleConvert`: replace project/pago logic with presupuesto (check `row.type` for ingreso/egreso to determine service vs payment)
- Update edit dialog title: `type === "presupuesto" ? "Presupuesto" : ...`
- Update edit form fields for presupuesto:

```tsx
{type === "presupuesto" && (
  <>
    <div className="space-y-2">
      <Label>Nombre</Label>
      <Input name="name" defaultValue={row.name} required />
    </div>
    <div className="space-y-2">
      <Label>Entidad</Label>
      <ClientCombobox
        clients={clients || []}
        name="clientId"
        defaultValue={row.clientId?.toString()}
        required
      />
    </div>
    <div className="space-y-2">
      <Label>Monto Total</Label>
      <Input
        name="totalAmount"
        type="number"
        step="0.01"
        defaultValue={row.totalAmount}
        required
      />
    </div>
    <div className="space-y-2">
      <Label>Estado</Label>
      <Select name="status" defaultValue={row.status || "activo"}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="activo">Activo</SelectItem>
          <SelectItem value="finalizado">Finalizado</SelectItem>
          <SelectItem value="pausado">Pausado</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </>
)}
```

- Update "Convertir a Recurrente" menu item: show for `type === "presupuesto"` instead of separate project/pago checks
- Update convert dialog text based on `row.type` (ingreso/egreso)

**Step 2: Commit**

```bash
git add components/tables/row-actions.tsx
git commit -m "feat: update row-actions for presupuesto type"
```

---

### Task 7: Update add-data-dialog.tsx

**Files:**
- Modify: `components/add-data-dialog.tsx`

**Step 1: Replace project/pago tabs with single presupuesto tab**

Key changes:
- Remove `ProjectCombobox` and `PagoCombobox` imports. Add `PresupuestoCombobox` import.
- Remove `Pago` type. Add `Presupuesto` type from `presupuestos` schema.
- Replace `pagosData` prop with unified `presupuestosData` prop:

```ts
export function AddDataDialog({
  clientsData,
  presupuestosData,
  servicesData,
  fabMode = false,
}: {
  clientsData: Client[];
  presupuestosData: Presupuesto[];
  servicesData: RecurringService[];
  fabMode?: boolean;
})
```

- Update `TransactionCategory`: `"presupuesto" | "recurring" | "other"`
- Update `selectedCategory` default: `"presupuesto"`
- Update `dialogTab` mapping: `case "presupuestos": return "presupuesto";` (remove projects/pagos cases)
- Replace `handleProjectSubmit` and `handlePagoSubmit` with `handlePresupuestoSubmit`:

```ts
async function handlePresupuestoSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setLoading(true);
  const form = e.currentTarget;
  const formData = new FormData(form);

  try {
    const res = await createPresupuestoAction({
      name: formData.get("name") as string,
      clientId: parseInt(formData.get("clientName") as string),
      totalAmount: parseFloat(formData.get("totalAmount") as string),
      type: formData.get("presupuestoType") as "ingreso" | "egreso",
    });

    if (res.success) {
      toast.success("Presupuesto creado exitosamente");
      form.reset();
    }
  } finally {
    setLoading(false);
  }
}
```

- Update tabs grid from `grid-cols-5` to `grid-cols-4` (transaction, presupuesto, entidad, recurrente)
- Replace project/pago TabsTrigger/TabsContent with single presupuesto tab:

```tsx
<TabsTrigger value="presupuesto">Presupuesto</TabsTrigger>
```

```tsx
<TabsContent value="presupuesto">
  <form onSubmit={handlePresupuestoSubmit} className="space-y-4 py-4">
    <div className="space-y-2">
      <Label>Nombre</Label>
      <Input name="name" placeholder="Ej: Rediseño Ecommerce" required />
    </div>
    <div className="space-y-2">
      <Label>Entidad</Label>
      <ClientCombobox clients={clientsData} name="clientName" required />
    </div>
    <div className="space-y-2">
      <Label>Tipo</Label>
      <Select name="presupuestoType" defaultValue="ingreso">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ingreso">Ingreso (te pagan)</SelectItem>
          <SelectItem value="egreso">Egreso (tú pagas)</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-2">
      <Label>Monto Total (USD)</Label>
      <Input name="totalAmount" type="number" step="0.01" required />
    </div>
    <Button type="submit" className="w-full" disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Presupuesto"}
    </Button>
  </form>
</TabsContent>
```

- Update transaction form category selector:
  - Replace `"project"` option with `"presupuesto"` → "Presupuesto (Azul)"
  - Remove `"pago"` option
  - Update conditional combobox: replace project/pago comboboxes with single:

```tsx
{selectedCategory === "presupuesto" && (
  <div className="space-y-2 slide-in-from-top-1 animate-in fade-in">
    <Label>Vincular a Presupuesto</Label>
    <PresupuestoCombobox presupuestos={presupuestosData} name="presupuestoId" />
  </div>
)}
```

- Remove `pagoId` from transaction creation, add `presupuestoId`

**Step 2: Commit**

```bash
git add components/add-data-dialog.tsx
git commit -m "feat: update add-data-dialog for presupuestos"
```

---

### Task 8: Update dashboard-tab.tsx

**Files:**
- Modify: `components/dashboard-tab.tsx`

**Step 1: Replace project/pago categories with presupuesto**

- Update `CategoryKey`: `"presupuesto" | "recurring" | "other"`
- Update `BarDataRow`: replace `project` and `pago` fields with `presupuesto_ingreso` and `presupuesto_egreso` (to keep the income/expense separation in the chart). Actually simpler: use `ingreso` and `egreso` as chart keys.
- Update `chartConfig`:

```ts
const chartConfig = {
  ingreso: { label: "Ingreso", color: "#4285F4" },
  recurring: { label: "Recurrente", color: "#7E57C2" },
  egreso: { label: "Egreso", color: "#E53935" },
  other: { label: "Otro", color: "#9AA0A6" },
} satisfies ChartConfig;
```

- Update bar data processing: for `"presupuesto"` category, check the transaction amount sign (positive → ingreso, negative → egreso). Or better: check the linked presupuesto's type. But since we only have the transaction data here, use: `presupuesto` category with positive amount = ingreso, negative = egreso. Actually, the existing code already negates pago amounts (`cat === "pago" ? -t.amount : t.amount`). With the new schema, the transaction amount sign already represents the direction. So:

```ts
data.forEach((t) => {
  const monthName = format(t.date, "MMM yyyy", { locale: es });
  if (!monthsMap[monthName]) {
    monthsMap[monthName] = { month: monthName, ingreso: 0, recurring: 0, egreso: 0, other: 0 };
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
```

- Update Bar components to use new data keys (`ingreso`, `recurring`, `egreso`, `other`)
- Update pie chart similarly

**Step 2: Commit**

```bash
git add components/dashboard-tab.tsx
git commit -m "feat: update dashboard chart for presupuesto categories"
```

---

### Task 9: Update page.tsx (main page)

**Files:**
- Modify: `app/page.tsx`

**Step 1: Update imports and queries**

- Remove `ProjectsTab`, `PagosTab` imports. Add `PresupuestosTab` import.
- Remove `projects`, `pagos` schema imports. Add `presupuestos` import.
- Replace `allProjects` and `allPagos` queries with single `allPresupuestos`:

```ts
const [allClients, allPresupuestos, allServices] = await Promise.all([
  db.query.clients.findMany({
    where: eq(clients.userId, userId),
  }),
  db.query.presupuestos.findMany({
    where: eq(presupuestos.userId, userId),
    with: {
      client: true,
      transactions: true,
    },
  }),
  db.query.recurringServices.findMany({
    where: eq(recurringServices.userId, userId),
    with: {
      client: true,
    },
  }),
]);
```

- Update `activeProjects` → `activePresupuestos`:
```ts
const activePresupuestos = allPresupuestos.filter((p) => p.status === "activo");
```

- Update `rawTransactions` query: replace `project` relation with `presupuesto`:
```ts
with: {
  presupuesto: { with: { client: true } },
  service: { with: { client: true } },
},
```

**Step 2: Update tab rendering**

- Replace two tabs (projects + pagos) with one:

```tsx
<TabsTrigger value="presupuestos">Presupuestos</TabsTrigger>
```

```tsx
<TabsContent value="presupuestos">
  <PresupuestosTab presupuestos={allPresupuestos} clients={allClients} />
</TabsContent>
```

- Remove the `pagos` TabsTrigger and TabsContent.

- Update `AddDataDialog` props: replace `projectsData` and `pagosData` with `presupuestosData`:

```tsx
<AddDataDialog
  clientsData={activeClients}
  presupuestosData={activePresupuestos}
  servicesData={activeServices}
/>
```

(Both desktop and mobile FAB instances)

**Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: update page.tsx for unified presupuestos tab"
```

---

### Task 10: Update filters-dialog.tsx and active-filters.tsx

**Files:**
- Modify: `components/filters-dialog.tsx`
- Modify: `components/active-filters.tsx`

**Step 1: Update filters-dialog.tsx**

- Replace `projects` import with `presupuestos` from schema
- Replace `Project` type with `Presupuesto` type
- Rename `projectId` state → `presupuestoId`
- Update filter param name from `"projectId"` to `"presupuestoId"`
- Update label from "Proyecto" to "Presupuesto"
- Update category select options: replace `"project"` with `"presupuesto"`, remove `"pago"`

**Step 2: Update active-filters.tsx**

- Replace `projects` import with `presupuestos`
- Replace `Project` type with `Presupuesto` type
- Update `getLabel` switch: replace `"projectId"` case with `"presupuestoId"` case
- Update `catMap`: replace `project: "Proyecto"` and `pago: "Pago"` with `presupuesto: "Presupuesto"`
- Update `filterKeys`: replace `"projectId"` with `"presupuestoId"`

**Step 3: Commit**

```bash
git add components/filters-dialog.tsx components/active-filters.tsx
git commit -m "feat: update filters for presupuestos"
```

---

### Task 11: Update transactions-tab.tsx

**Files:**
- Modify: `components/transactions-tab.tsx`

**Step 1: Update transaction type**

- In `TransactionWithRelations` interface: replace `projectId`, `pagoId` with `presupuestoId`, and replace `project?` relation with `presupuesto?`
- Update `TransactionCategory`: `"presupuesto" | "recurring" | "other"`
- Update any display logic that shows project/pago names to use `presupuesto` relation
- Update category badge labels: replace "Proyecto"/"Pago" with "Presupuesto" or use the presupuesto type to show "Ingreso"/"Egreso"

**Step 2: Commit**

```bash
git add components/transactions-tab.tsx
git commit -m "feat: update transactions-tab for presupuestos"
```

---

### Task 12: Update csv-importer.tsx

**Files:**
- Modify: `components/csv-importer.tsx`

**Step 1: Update CSV template and parsing**

- In the CSV template: replace separate "proyecto" and "pago" TipoDato with unified "presupuesto" type. Add Estado field for type: `ingreso` or `egreso`
- Update parsing switch: replace `case "proyecto"` and `case "pago"` with `case "presupuesto"` that reads the type from Estado column
- Update `RawImportData` payload to match new action signature

**Step 2: Commit**

```bash
git add components/csv-importer.tsx
git commit -m "feat: update csv-importer for presupuestos"
```

---

### Task 13: Update mobile-nav.tsx

**Files:**
- Modify: `components/mobile-nav.tsx`

**Step 1: Update tab labels**

Replace:
```ts
const TAB_LABELS: Record<string, string> = {
  overview: "Dashboard",
  transactions: "Movimientos",
  projects: "Proyectos",
  pagos: "Pagos",
  maintenance: "Recurrentes",
};
```

With:
```ts
const TAB_LABELS: Record<string, string> = {
  overview: "Dashboard",
  transactions: "Movimientos",
  presupuestos: "Presupuestos",
  maintenance: "Recurrentes",
};
```

**Step 2: Commit**

```bash
git add components/mobile-nav.tsx
git commit -m "feat: update mobile-nav tab labels"
```

---

### Task 14: Run migration and verify

**Step 1: Run the migration**

```bash
npx tsx scripts/migrate-presupuestos.ts
```

Expected: All migration steps complete successfully.

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete presupuestos merge — unified projects and pagos"
```
