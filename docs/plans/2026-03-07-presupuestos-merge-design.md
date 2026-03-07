# Merge Proyectos + Pagos into Presupuestos — Design

**Goal:** Unify the nearly identical Proyectos and Pagos concepts into a single "Presupuestos" tab with a type column for filtering (Ingresos/Egresos).

## DB Schema

### New `presupuestos` table (replaces `projects` + `pagos`)

- `id` (integer, PK, autoIncrement)
- `userId` (text, FK → users.id, onDelete cascade)
- `clientId` (integer, FK → clients.id)
- `name` (text, notNull)
- `totalAmount` (real, notNull, always positive)
- `type` (text, enum: "ingreso" | "egreso", notNull)
- `status` (text, default "activo")

### Transactions table changes

- Remove `projectId` and `pagoId` columns
- Add `presupuestoId` (integer, FK → presupuestos.id)
- Category enum: replace "project" and "pago" with "presupuesto"

### Relations

- `presupuestos` → many transactions
- `clients` → many presupuestos
- `users` → many presupuestos
- `transactions.presupuestoId` → one presupuesto

## UI

### Single "Presupuestos" tab

- Replaces both "Proyectos" and "Pagos" tabs
- Filter by type: Todos / Ingresos / Egresos
- Amount display: green text for ingreso, red text for egreso
- Paid column: green for ingreso, red for egreso
- Progress bar: same as before
- Unified status values: activo, finalizado, pausado
- Status badges derived from payment progress (same logic as before)

### Add Data dialog

- Replace separate "Proyecto" and "Pago" creation tabs with single "Presupuesto" tab
- Type selector: Ingreso / Egreso

### Row Actions

- Replace separate project/pago edit/delete with single "presupuesto" type
- Convert to recurring: available for both types

### Dashboard chart

- Replace separate "project"/"pago" data keys with presupuesto type-based splitting

## Data Migration

A migration script that:
1. Creates the `presupuestos` table
2. Copies all `projects` rows → presupuestos with type="ingreso"
3. Copies all `pagos` rows → presupuestos with type="egreso"
4. Updates `transactions`: maps `projectId` → `presupuestoId`, `pagoId` → `presupuestoId`, category "project"/"pago" → "presupuesto"
5. Drops old `projects` and `pagos` tables and their FK columns from transactions

## Files Affected

- **Delete:** `projects-tab.tsx`, `pagos-tab.tsx`, `project-combobox.tsx`, `pago-combobox.tsx`
- **Create:** `presupuestos-tab.tsx`, `presupuesto-combobox.tsx`, migration script
- **Modify:** `db/schema.ts`, `app/actions.ts`, `app/page.tsx`, `components/tables/row-actions.tsx`, `components/add-data-dialog.tsx`, `components/dashboard-tab.tsx`, `components/filters-dialog.tsx`, `components/active-filters.tsx`, `components/csv-importer.tsx`
