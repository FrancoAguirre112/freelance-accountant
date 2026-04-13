# Design System

A portable specification of the design language used in this project. Domain-agnostic — reuse for any Next.js app that should feel like a sibling product.

---

## 1. Philosophy & Quirks (read first)

The five decisions that define the "feel":

1. **Purple-centric, perceptually uniform.** All colors are expressed in `oklch()`, anchored to hue `290` (purple). Secondary accent hues: `190` (cyan), `330` (magenta), `27` (destructive red). Never use `#hex` or `hsl()` for theme tokens.
2. **Default to dark mode.** `ThemeProvider` ships with `defaultTheme="dark"` and `disableTransitionOnChange`. Light mode exists but dark is the showroom.
3. **Subtle motion, user-controllable.** All animations (CSS + GSAP) are globally disabled when `<html>` has the class `reduce-motion`. A Performance toggle writes to `localStorage` and flips this class. Build every new animation with a `reduce-motion` override.
4. **Primitive-first.** Everything UI lives in `components/ui/` (shadcn "new-york" style). Feature components compose primitives; they never re-implement buttons, dialogs, or inputs.
5. **No form library.** Forms use native `FormData` + server actions. Do not add `react-hook-form` or `zod` for form validation just to match a pattern — there is no pattern to match.

Less obvious quirks worth preserving:
- Base radius is **`0.625rem` (10px)**, not the shadcn default `0.5rem`. All radii derive via `calc(var(--radius) ± Npx)`.
- **Scrollbars are restyled** (8px, pill, `--border` color). Comes for free on `*`.
- **`button:hover { cursor: pointer }`** is set globally. Tailwind v4 drops it by default; this brings it back.
- **`touch-action: manipulation`** on all interactive elements (removes 300ms tap delay on mobile).
- **`overscroll-behavior: contain`** on `[role="dialog"]` (scroll inside a modal doesn't scroll the page).
- Icon library is **Lucide** only. No mixed icon sets.
- Font stack: **Inter** for body, **Montserrat 900** for hero/branding headings only.

---

## 2. Tech Stack

| Area | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router, RSC) | `components.json` sets `rsc: true, tsx: true` |
| CSS | Tailwind CSS v4 | `@tailwindcss/postcss`, no `tailwind.config.js` — everything lives in `globals.css` via `@theme inline` |
| Component layer | shadcn/ui "new-york" | `baseColor: neutral`, `cssVariables: true` |
| Icons | `lucide-react` | |
| Variants | `class-variance-authority` + `tailwind-merge` + `clsx` | Expose via `@/lib/utils` `cn()` |
| Animation (declarative) | `tw-animate-css` + keyframes in `globals.css` | |
| Animation (imperative) | `gsap` | Via custom hooks only |
| Toasts | `sonner` (top-center, rich colors) | |
| Charts | `recharts` 2.15.4 | Wrapped by `components/ui/chart.tsx` |
| Dates | `react-day-picker` | |
| Theming | `next-themes` (class mode) | |
| Command palette | `cmdk` | |
| Popover / dialog / etc. | `radix-ui` | via shadcn primitives |

---

## 3. Color Tokens

All tokens live in `app/globals.css`. Copy the whole file as the starting point (see `§ 10`).

### 3.1 Light (`:root`)

```css
--radius: 0.625rem;
--background:             oklch(0.98 0.008 290);
--foreground:             oklch(0.18 0.03  290);
--card:                   oklch(1    0     0  );
--card-foreground:        oklch(0.18 0.03  290);
--popover:                oklch(1    0     0  );
--popover-foreground:     oklch(0.18 0.03  290);
--primary:                oklch(0.38 0.19  290);
--primary-foreground:     oklch(0.98 0.008 290);
--secondary:              oklch(0.94 0.03  290);
--secondary-foreground:   oklch(0.25 0.12  290);
--muted:                  oklch(0.95 0.02  290);
--muted-foreground:       oklch(0.5  0.04  290);
--accent:                 oklch(0.94 0.03  290);
--accent-foreground:      oklch(0.25 0.12  290);
--destructive:            oklch(0.577 0.245 27.325);
--border:                 oklch(0.9  0.02  290);
--input:                  oklch(0.9  0.02  290);
--ring:                   oklch(0.72 0.14  290);
--chart-1:                oklch(0.72 0.14  290);  /* lilac     */
--chart-2:                oklch(0.38 0.19  290);  /* deep purple */
--chart-3:                oklch(0.6  0.12  190);  /* cyan      */
--chart-4:                oklch(0.75 0.1   330);  /* pink      */
--chart-5:                oklch(0.55 0.08  290);  /* muted purple */
/* sidebar mirrors the above with same values */
```

### 3.2 Dark (`.dark`)

Key deltas vs. light:
- `--background: oklch(0.14 0.02 290)` — near-black with purple cast, not pure `#000`.
- `--card: oklch(0.2 0.03 290)` — card is **lighter** than background in dark mode (inverts the light-mode relationship). This is intentional.
- `--primary` stays identical (`oklch(0.38 0.19 290)`). The purple is the product — it reads in both modes.
- `--sidebar-primary` shifts to the brighter `oklch(0.72 0.14 290)` (the light-mode `--ring`).

### 3.3 Semantic usage rules

- **Never** hardcode a color on a component. Always reference a token.
- `--primary` is for **actions**, not branding surfaces. Fills buttons, active tab, active link.
- `--accent` is **hover/focus surface** — same value as secondary in this palette, distinct purpose.
- `--muted` / `--muted-foreground` for **tertiary text & disabled backgrounds**.
- `--destructive` for **irreversible/destructive actions only** (delete, cancel-and-lose-data).
- `--ring` is the focus indicator; `3px` width at `/50` opacity (see §7).

### 3.4 Radius scale

```
--radius-sm: calc(var(--radius) - 4px);   /*  6px  */
--radius-md: calc(var(--radius) - 2px);   /*  8px  */
--radius-lg: var(--radius);               /* 10px  */
--radius-xl: calc(var(--radius) + 4px);   /* 14px  */
--radius-2xl: calc(var(--radius) + 8px);  /* 18px  */
--radius-3xl: calc(var(--radius) + 12px); /* 22px  */
--radius-4xl: calc(var(--radius) + 16px); /* 26px  */
```

Defaults: **cards `rounded-xl`**, **buttons/inputs `rounded-md`**, **badges `rounded-full`**, **popovers/tooltips `rounded-lg`**.

---

## 4. Typography

```tsx
import { Inter, Montserrat } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
const montserrat = Montserrat({ subsets: ["latin"], weight: "900" });
```

- **Body & UI:** Inter — applied on `<body>` via layout.
- **Display:** Montserrat 900 — reserved for hero titles, logos, onboarding splash. Do not use for card titles or headings inside the app.
- **No serif.** No handwritten or display fonts beyond the above.

Size conventions (Tailwind):
- Card title: `text-base font-semibold` (not `text-lg`)
- Card description: `text-sm text-muted-foreground`
- KPI numbers: `text-2xl font-semibold tabular-nums` (plus GSAP count-up)
- Table cells: `text-sm`
- Badges / meta: `text-xs font-medium`

Always use `tabular-nums` on numeric columns and dashboards.

---

## 5. Component Variants

### 5.1 Button (`components/ui/button.tsx`)

Base classes (copy verbatim):
```
inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md
text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50
[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0
outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive
```

| Variant | Classes |
|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `destructive` | `bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60` |
| `outline` | `border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50` |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| `ghost` | `hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50` |
| `link` | `text-primary underline-offset-4 hover:underline` |

| Size | Height / Classes |
|---|---|
| `xs` | `h-6 px-2 text-xs`, icon size 3 |
| `sm` | `h-8 px-3` |
| `default` | `h-9 px-4 py-2` |
| `lg` | `h-10 px-6` |
| `icon-xs` | `size-6 rounded-md`, icon size 3 |
| `icon-sm` | `size-8` |
| `icon` | `size-9` |
| `icon-lg` | `size-10` |

**Quirk:** the `dark:bg-input/30` treatment on the `outline` variant is intentional — outline buttons in dark mode sit on a translucent input-colored surface, not transparent.

### 5.2 Badge (`components/ui/badge.tsx`)

Pill shape (`rounded-full`), `px-2 py-0.5 text-xs font-medium`. Variants mirror Button but there is no size scale. Uses `[a&]:hover:...` so anchor badges get hover, static ones don't.

### 5.3 Card (`components/ui/card.tsx`)

```
bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm
```

Sub-components: `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`. `CardHeader` uses **container queries** (`@container/card-header`) and auto-switches to a two-column grid when a `CardAction` is present:

```
@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6
has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6
```

Hover shadow (from globals.css):
```css
[data-slot="card"] { transition: box-shadow 0.15s ease; }
[data-slot="card"]:hover        { box-shadow: 0 2px 16px rgba(0,0,0,0.05); }
.dark [data-slot="card"]:hover  { box-shadow: 0 2px 16px rgba(0,0,0,0.15); }
```

### 5.4 Tabs

Two variants: `default` (pill-in-muted-background) and `line` (underlined). Active tab on `default`: `bg-background` + `shadow-sm`. Tab content always gets `animate-tab-in` (fade + 8px slide-up over 0.35s).

### 5.5 Dialog / Sheet / Popover

- Overlay: `fixed inset-0 z-50 bg-black/50`
- Enter animation: `fade-in-0 zoom-in-95` over 200ms (from `tw-animate-css`)
- Sheets slide from edge, default `side="left"`, width `280px` for mobile nav.
- Dialogs **must** include `<DialogHeader>` with `<DialogTitle>` for a11y (Radix will warn otherwise).

### 5.6 Toasts (Sonner)

Always configured with:
```tsx
<Toaster
  theme={theme}
  position="top-center"
  richColors
  icons={{ success, info, warning, error, loading }}  // Lucide icons at size-4
  style={{
    "--normal-bg": "var(--popover)",
    "--normal-text": "var(--popover-foreground)",
    "--normal-border": "var(--border)",
    "--border-radius": "var(--radius)",
  }}
/>
```

Usage: `toast.success("Saved", { description: "..." })` — always include a description for non-trivial actions.

### 5.7 Combobox / Command

Use `cmdk` through the shadcn `Command` primitive wrapped inside a `Popover`. Show a `Check` icon (size 4) on the selected item, `ChevronsUpDown` on the trigger.

---

## 6. Motion System

### 6.1 CSS keyframes (globals.css)

| Class | Duration | Easing | Transform |
|---|---|---|---|
| `animate-tab-in` | 0.35s | ease-out | `translateY(8px) → 0`, opacity 0→1 |
| `animate-expand-in` | 0.20s | ease-out | `translateY(-4px) → 0`, opacity 0→1 |
| `animate-chevron` | 0.20s | ease | `rotate(0 → 90deg)` via `data-expanded` |
| `[data-slot="card"]` hover | 0.15s | ease | box-shadow |

All of the above are neutralized by `.reduce-motion` on `<html>`.

### 6.2 GSAP hooks

Two custom hooks only. Do not reach for GSAP directly in components.

```ts
// hooks/use-gsap.ts

useStaggerReveal<T>({ delay?: 0, stagger?: 0.06, y?: 16, duration?: 0.45 })
// Fades + slides up direct children. Use on a container (grid, flex wrapper).
// Easing: power2.out. No-ops when performanceMode is on.

useCountUp(target, { duration?: 0.8, delay?: 0.15, prefix?: "$", decimals?: 2 })
// Animates a numeric readout from 0 to target. Returns ref for the element.
// Use for KPIs, dashboards, summary stats.
```

**New animations must:**
1. Read `useContext(PerformanceContext)` or check `.reduce-motion` and short-circuit when set.
2. Use `power2.out` unless there is a specific reason to choose another curve.
3. Prefer CSS keyframes over GSAP for one-shot enter animations. GSAP only when you need sequencing, counting, or stagger.

### 6.3 Performance context

`components/performance-context.tsx` exposes a boolean. A user toggle (in Settings) flips:
```ts
document.documentElement.classList.toggle("reduce-motion", performanceMode);
localStorage.setItem("performance-mode", String(performanceMode));
```

Provider order in layout: `SessionProvider > ThemeProvider > PerformanceProvider`.

---

## 7. Focus & Accessibility

Universal focus ring (apply to every interactive primitive):
```
outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
```

Error state:
```
aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive
```

Rules:
- Always `focus-visible`, never `focus`.
- 3px ring at 50% opacity is the house standard — do not thin it or remove it.
- All primitives expose `data-slot="..."` (e.g. `data-slot="button"`, `data-slot="card"`, `data-slot="dialog"`). Use these for structural styling, not classnames.
- `sr-only` for icon-only button labels.

---

## 8. Layout Patterns

- **Container queries** on `CardHeader` via `@container/card-header`. Do not add a second container to a card unless necessary.
- **Mobile nav** is a `Sheet` (left side, 280px) + a `Select` for primary tab switching. Desktop shows the full `TabsList`.
- **Breakpoints:** `sm` (640), `md` (768) are the workhorses. `lg`/`xl` are rare.
- **Spacing rhythm:** card internal padding `p-6`, stack gap `gap-6`, row gap `gap-4`, inline gap `gap-2`.
- **Tables** use the `Table` primitive with `SortableHeader` for sortable columns.

---

## 9. Charts

```ts
const chartConfig = {
  key1: { label: "Label", color: "var(--chart-1)" },
  key2: { label: "Label", color: "var(--chart-2)" },
  // ...up to chart-5
} satisfies ChartConfig;
```

- Always reference `--chart-N`, not hex. If the domain needs category colors (e.g. red=expense, green=income), add **semantic aliases** in `globals.css` like `--color-income: var(--chart-3)` rather than dropping raw hex.
- `<ChartContainer id="unique-id" config={chartConfig}>` is required — it injects the `--color-key1` vars scoped to that chart.
- Tooltip: `border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl`.
- `CartesianGrid strokeDasharray="3 3"` for line/bar charts.

---

## 10. Starter files for a new project

### 10.1 Minimum file list to copy

```
app/globals.css                    # theme tokens + base + keyframes
components.json                    # shadcn config
lib/utils.ts                       # cn()
components/ui/*.tsx                # shadcn primitives (button, card, dialog, etc.)
components/theme-provider.tsx      # next-themes wrapper
components/theme-toggle.tsx        # Sun/Moon toggle
components/performance-context.tsx # reduce-motion toggle
hooks/use-gsap.ts                  # useStaggerReveal, useCountUp
```

### 10.2 `globals.css` skeleton

Use the version in `app/globals.css` verbatim — it is the source of truth. Remove nothing; the long auto-generated selector on lines ~157 is a `Select` width fix that you will want.

### 10.3 Dependencies

```jsonc
{
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.4.0",
    "lucide-react": "^0.564.0",
    "radix-ui": "^1.4.3",
    "cmdk": "^1.1.1",
    "sonner": "^2.0.7",
    "recharts": "2.15.4",
    "react-day-picker": "^9.13.2",
    "next-themes": "^0.4.6",
    "gsap": "^3.14.2",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4",
    "shadcn": "^3.8.4"
  }
}
```

### 10.4 `components.json`

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### 10.5 Provider stack (app/layout.tsx)

```tsx
<body className={inter.className}>
  <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
    <PerformanceProvider>
      {children}
      <Toaster />
    </PerformanceProvider>
  </ThemeProvider>
</body>
```

---

## 11. Do & Don't (quick reference)

**Do**
- Reach for a shadcn primitive before writing markup.
- Use `oklch()` + tokens for all color. Re-theme by editing `:root` and `.dark` — nothing else.
- Keep animations under 0.5s and power2.out / ease-out.
- Guard every animation with a `.reduce-motion` override.
- Use Lucide icons at `size-4` (default) or `size-3` (dense).
- Use `tabular-nums` on every number that can change.

**Don't**
- Don't install `react-hook-form`/`zod` for simple forms — use `FormData`.
- Don't mix icon libraries.
- Don't hardcode `#hex` colors anywhere except in one-off illustrations.
- Don't remove the 3px focus ring.
- Don't set `--radius` smaller than `0.5rem` or larger than `0.75rem` — the component scale will visibly break.
- Don't animate layout properties (`width`, `height`) — animate `transform` / `opacity` / `box-shadow`.
- Don't use `@apply` for token-heavy class strings; keep Tailwind classes in JSX.

---

## 12. When adapting for a new domain

The only things domain-specific in this project:
- Chart color semantics (income/expense/recurring) — replace with your categories, keep referencing `--chart-N`.
- Montserrat 900 hero font — swap only if the new brand needs a different display face.
- Sonner icon set — keep as-is, it is domain-agnostic.

Everything else (palette, radii, motion, focus ring, component variants, provider stack) transfers 1:1. Copy `globals.css`, `components.json`, the `components/ui/` folder, and the two hooks — you will have the same "feel" on day one.
