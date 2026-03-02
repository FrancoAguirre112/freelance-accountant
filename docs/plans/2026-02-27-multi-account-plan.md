# Multi-Account with Google Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google authentication, multi-user data isolation, profile types (Programador/Marketing), and simplify the app by merging salary into recurring services.

**Architecture:** Auth.js v5 with Drizzle adapter for Google sign-in and database sessions. Add `userId` column to all existing tables. Middleware protects all routes. Onboarding page captures profile type on first sign-in. Remove SalaryTab, rename Mantenimientos to "Servicios Recurrentes".

**Tech Stack:** Next.js 16, Auth.js v5 (next-auth@beta), Drizzle ORM, LibSQL/Turso, Tailwind CSS, shadcn/ui

---

### Task 1: Install Auth.js dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install next-auth and the Drizzle adapter**

Run:
```bash
npm install next-auth@beta @auth/drizzle-adapter
```

**Step 2: Verify installation**

Run:
```bash
npm ls next-auth @auth/drizzle-adapter
```
Expected: Both packages listed without errors.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install next-auth and drizzle adapter"
```

---

### Task 2: Add Auth.js schema tables to Drizzle

**Files:**
- Modify: `db/schema.ts`

**Step 1: Add Auth.js tables and profileType to schema**

Add these tables to `db/schema.ts` (after the existing imports, before the existing `clients` table):

```typescript
// === AUTH.JS TABLES ===

export const users = sqliteTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  profileType: text("profileType", { enum: ["programador", "marketing"] }),
});

export const accounts = sqliteTable("account", {
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});
```

**Step 2: Add `userId` column to existing tables**

Modify the existing `clients`, `projects`, `recurringServices`, and `transactions` tables. Add `userId` to each:

```typescript
// In clients table, add:
userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

// In projects table, add:
userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

// In recurringServices table, add:
userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

// In transactions table, add:
userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
```

**Step 3: Add relations for the users table**

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  clients: many(clients),
  projects: many(projects),
  transactions: many(transactions),
  recurringServices: many(recurringServices),
}));
```

Also update `clientsRelations`, `projectsRelations`, `recurringServicesRelations`, and `transactionsRelations` to include the `user` relation:

```typescript
// In clientsRelations, add:
user: one(users, { fields: [clients.userId], references: [users.id] }),

// In projectsRelations, add:
user: one(users, { fields: [projects.userId], references: [users.id] }),

// In recurringServicesRelations, add:
user: one(users, { fields: [recurringServices.userId], references: [users.id] }),

// In transactionsRelations, add:
user: one(users, { fields: [transactions.userId], references: [users.id] }),
```

**Step 4: Generate and push migration**

Run:
```bash
npx drizzle-kit generate
npx drizzle-kit push
```

Note: If push fails due to NOT NULL constraint on userId for existing data, you may need to either:
- Clear existing data first (if OK to lose it), or
- Add userId as nullable first, update rows, then alter to NOT NULL

**Step 5: Commit**

```bash
git add db/schema.ts migrations/
git commit -m "feat: add auth.js tables and userId to all data tables"
```

---

### Task 3: Configure Auth.js

**Files:**
- Create: `auth.ts` (project root)
- Create: `app/api/auth/[...nextauth]/route.ts`

**Step 1: Create the Auth.js config at project root**

Create `auth.ts`:

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google],
  callbacks: {
    session({ session, user }) {
      // Expose userId and profileType in the session
      session.user.id = user.id;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

**Step 2: Create the API route handler**

Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

**Step 3: Add environment variables to `.env.local`**

Add these variables (the user must fill in real values from Google Cloud Console):

```
AUTH_SECRET=<generate with `npx auth secret`>
AUTH_GOOGLE_ID=<Google OAuth client ID>
AUTH_GOOGLE_SECRET=<Google OAuth client secret>
```

Run to generate the secret:
```bash
npx auth secret
```

**Step 4: Commit**

```bash
git add auth.ts app/api/auth/
git commit -m "feat: configure auth.js with google provider and drizzle adapter"
```

---

### Task 4: Create middleware for route protection

**Files:**
- Create: `middleware.ts` (project root)

**Step 1: Create the middleware**

Create `middleware.ts`:

```typescript
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth;

  // Public routes
  const isLoginPage = nextUrl.pathname === "/login";
  const isAuthApi = nextUrl.pathname.startsWith("/api/auth");

  // Allow auth API and login page without auth
  if (isAuthApi) return NextResponse.next();

  if (isLoginPage) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // Everything else requires auth
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Check onboarding: if user has no profileType, redirect to onboarding
  // (except if already on onboarding page)
  const isOnboardingPage = nextUrl.pathname === "/onboarding";
  const profileType = req.auth?.user?.profileType;

  if (!profileType && !isOnboardingPage) {
    return NextResponse.redirect(new URL("/onboarding", nextUrl));
  }

  if (profileType && isOnboardingPage) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.webp$).*)"],
};
```

Note: The `profileType` check in middleware requires extending the Auth.js session type. We'll handle that in the auth config by querying the user table in the session callback.

**Step 2: Update `auth.ts` to include profileType in session**

Update the session callback in `auth.ts` to also fetch and include `profileType`:

```typescript
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// In the callbacks:
callbacks: {
  async session({ session, user }) {
    session.user.id = user.id;
    // Fetch profileType from DB
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    session.user.profileType = dbUser?.profileType ?? null;
    return session;
  },
},
```

**Step 3: Create type augmentation for Auth.js**

Create `types/next-auth.d.ts`:

```typescript
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      profileType?: "programador" | "marketing" | null;
    };
  }

  interface User {
    profileType?: "programador" | "marketing" | null;
  }
}
```

**Step 4: Commit**

```bash
git add middleware.ts types/
git commit -m "feat: add middleware for auth protection and onboarding redirect"
```

---

### Task 5: Create login page

**Files:**
- Create: `app/login/page.tsx`

**Step 1: Create the login page**

Create `app/login/page.tsx`:

```tsx
import { signIn } from "@/auth";
import Image from "next/image";
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({ subsets: ["latin"], weight: "900" });

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-6 p-8 bg-white rounded-lg shadow-sm border max-w-sm w-full">
        <div className="flex items-center gap-3">
          <Image src="/Flogo.webp" alt="Logo" width={40} height={40} />
          <h1 className={`${montserrat.className} text-3xl tracking-tight`}>
            Fiscus
          </h1>
        </div>
        <p className="text-muted-foreground text-sm text-center">
          Gestión de ingresos y proyectos
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-3 px-6 py-3 bg-white border rounded-lg hover:bg-gray-50 transition-colors w-full"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span className="text-sm font-medium">Iniciar sesión con Google</span>
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/login/
git commit -m "feat: add login page with google sign-in"
```

---

### Task 6: Create onboarding page

**Files:**
- Create: `app/onboarding/page.tsx`
- Modify: `app/actions.ts` (add setProfileType action)

**Step 1: Add the setProfileType server action**

Add to `app/actions.ts`:

```typescript
import { auth } from "@/auth";
import { users } from "@/db/schema";

export async function setProfileTypeAction(
  profileType: "programador" | "marketing",
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db
    .update(users)
    .set({ profileType })
    .where(eq(users.id, session.user.id));

  revalidatePath("/");
  return { success: true };
}
```

**Step 2: Create the onboarding page**

Create `app/onboarding/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { setProfileTypeAction } from "@/app/actions";
import Image from "next/image";
import { Montserrat } from "next/font/google";
import { Code2, Megaphone } from "lucide-react";

const montserrat = Montserrat({ subsets: ["latin"], weight: "900" });

export default function OnboardingPage() {
  const router = useRouter();

  async function selectProfile(type: "programador" | "marketing") {
    await setProfileTypeAction(type);
    router.push("/");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-8 p-8 max-w-lg w-full">
        <div className="flex items-center gap-3">
          <Image src="/Flogo.webp" alt="Logo" width={40} height={40} />
          <h1 className={`${montserrat.className} text-3xl tracking-tight`}>
            Fiscus
          </h1>
        </div>
        <p className="text-muted-foreground text-center">
          Selecciona tu tipo de perfil para comenzar
        </p>

        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            onClick={() => selectProfile("programador")}
            className="flex flex-col items-center gap-4 p-6 bg-white border rounded-lg hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
          >
            <Code2 className="w-10 h-10 text-blue-600" />
            <span className="font-semibold">Programador</span>
            <span className="text-xs text-muted-foreground text-center">
              Desarrollo de software y proyectos web
            </span>
          </button>

          <button
            onClick={() => selectProfile("marketing")}
            className="flex flex-col items-center gap-4 p-6 bg-white border rounded-lg hover:border-purple-500 hover:shadow-md transition-all cursor-pointer"
          >
            <Megaphone className="w-10 h-10 text-purple-600" />
            <span className="font-semibold">Marketing</span>
            <span className="text-xs text-muted-foreground text-center">
              Campañas, contenido y servicios digitales
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/onboarding/ app/actions.ts
git commit -m "feat: add onboarding page with profile type selection"
```

---

### Task 7: Add auth guard to all server actions

**Files:**
- Modify: `app/actions.ts`

**Step 1: Create a helper function to get authenticated userId**

Add at the top of `app/actions.ts` (after existing imports):

```typescript
import { auth } from "@/auth";
import { users } from "@/db/schema";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}
```

**Step 2: Update every action to use userId**

Update each function to:
1. Call `const userId = await requireUserId();` at the start
2. Add `userId` to all inserts
3. Add `eq(tableName.userId, userId)` to all queries/updates/deletes

Key patterns:

For **findOrCreateClient**: Add userId parameter and filter by it:
```typescript
async function findOrCreateClient(name: string, userId: string): Promise<number> {
  const existingClient = await db.query.clients.findFirst({
    where: and(eq(clients.name, name), eq(clients.userId, userId)),
  });
  if (existingClient) return existingClient.id;
  const newClient = await db
    .insert(clients)
    .values({ name, status: "active", userId })
    .returning({ id: clients.id });
  return newClient[0].id;
}
```

For **createClientAction**: Add userId to insert:
```typescript
export async function createClientAction(data: InferInsertModel<typeof clients>) {
  const userId = await requireUserId();
  await db.insert(clients).values({ ...data, userId });
  revalidatePath("/");
  return { success: true };
}
```

For **deleteClientAction**: Add userId check to where clause:
```typescript
// Change: eq(clients.id, id)
// To: and(eq(clients.id, id), eq(clients.userId, userId))
```

Apply this same pattern to ALL actions:
- `importTransactionsAction` — add userId to each transaction
- `createClientAction` — add userId
- `updateClientAction` — add userId to where
- `deleteClientAction` — add userId to where + sub-queries
- `createProjectAction` — add userId
- `createTransactionAction` — add userId
- `createRecurringServiceAction` — add userId (also update findOrCreateClient call)
- `bulkSmartImportAction` — add userId to all inserts and queries
- `updateTransactionAction` — add userId to where
- `updateProjectAction` — add userId to where
- `deleteTransactionAction` — add userId to where
- `deleteProjectAction` — add userId to where
- `deleteRecurringServiceAction` — add userId to where
- `getSalaryCoverageAction` — add userId to where (this action will be removed in Task 9, but update it for now)
- `getMaintenanceCoverageAction` — add userId to where

**Step 3: Commit**

```bash
git add app/actions.ts
git commit -m "feat: add auth guard and userId filtering to all server actions"
```

---

### Task 8: Update main dashboard page to filter by user

**Files:**
- Modify: `app/page.tsx`

**Step 1: Import auth and filter queries by userId**

At the top of `app/page.tsx`, add:

```typescript
import { auth } from "@/auth";
```

At the start of the `DashboardPage` function, get the session:

```typescript
const session = await auth();
const userId = session!.user.id;
```

**Step 2: Update all DB queries to filter by userId**

Change the parallel queries to filter:

```typescript
const [allClients, allProjects, allServices] = await Promise.all([
  db.query.clients.findMany({
    where: eq(clients.userId, userId),
  }),
  db.query.projects.findMany({
    where: eq(projects.userId, userId),
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

Also update the transactions query:

```typescript
const rawTransactions = await db.query.transactions.findMany({
  where: and(
    eq(transactions.userId, userId),
    between(transactions.date, queryFrom, queryTo),
  ),
  with: {
    project: { with: { client: true } },
    service: { with: { client: true } },
  },
  orderBy: [desc(transactions.date)],
});
```

Add `eq` and `and` to imports from `drizzle-orm`.

**Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: filter dashboard queries by authenticated userId"
```

---

### Task 9: Remove SalaryTab and rename Mantenimientos to Servicios Recurrentes

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/maintenance-tab.tsx`
- Delete: `components/salary-tab.tsx`
- Modify: `app/actions.ts` (remove `getSalaryCoverageAction`)

**Step 1: Update `app/page.tsx`**

Remove the SalaryTab import and usage:
```typescript
// Remove this line:
import { SalaryTab } from "@/components/salary-tab";
```

Remove the salary tab trigger and content:
```tsx
// Remove:
<TabsTrigger value="salary">Sueldos (RTN)</TabsTrigger>

// Remove:
<TabsContent value="salary">
  <SalaryTab ... />
</TabsContent>
```

Rename the maintenance tab:
```tsx
// Change:
<TabsTrigger value="maintenance">Mantenimientos</TabsTrigger>
// To:
<TabsTrigger value="maintenance">Servicios Recurrentes</TabsTrigger>
```

**Step 2: Update `components/maintenance-tab.tsx` to show ALL recurring services**

Change the filter on line 58 from:
```typescript
const maintenanceServices = services.filter((s) => s.type === "maintenance");
```
To:
```typescript
const maintenanceServices = services; // Show all recurring services (maintenance + salary)
```

Update the related transactions filter on line 60 from:
```typescript
const relatedTransactions = transactions.filter(
  (t) => t.category === "maintenance" && ...
);
```
To:
```typescript
const relatedTransactions = transactions.filter(
  (t) =>
    (t.category === "maintenance" || t.category === "salary") &&
    t.date >= new Date(from.setUTCHours(0, 0, 0, 0)) &&
    t.date <= new Date(to.setUTCHours(23, 59, 59, 999))
);
```

Update the empty state message from:
```
No hay servicios de mantenimiento activos.
```
To:
```
No hay servicios recurrentes activos.
```

**Step 3: Delete `components/salary-tab.tsx`**

Run:
```bash
rm components/salary-tab.tsx
```

**Step 4: Remove `getSalaryCoverageAction` from `app/actions.ts`**

Delete the entire `getSalaryCoverageAction` function (lines 375-415 approximately). This is dead code now.

**Step 5: Commit**

```bash
git add app/page.tsx components/maintenance-tab.tsx app/actions.ts
git rm components/salary-tab.tsx
git commit -m "feat: remove salary tab, merge into servicios recurrentes"
```

---

### Task 10: Add user menu to header

**Files:**
- Create: `components/user-menu.tsx`
- Modify: `app/page.tsx`

**Step 1: Create the user menu component**

Create `components/user-menu.tsx`:

```tsx
import { auth, signOut } from "@/auth";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

export async function UserMenu() {
  const session = await auth();
  if (!session?.user) return null;

  const initials = session.user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full hover:bg-muted p-1 pr-3 transition-colors">
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name ?? "User"}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
            {initials}
          </div>
        )}
        <span className="text-sm font-medium hidden sm:inline">
          {session.user.name}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span>{session.user.name}</span>
          <span className="text-xs text-muted-foreground font-normal">
            {session.user.email}
          </span>
          <Badge variant="secondary" className="w-fit text-xs capitalize">
            {session.user.profileType}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <DropdownMenuItem asChild>
            <button className="w-full cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Add UserMenu to `app/page.tsx` header**

Import and place the UserMenu in the header area, next to the existing controls:

```tsx
import { UserMenu } from "@/components/user-menu";
```

In the JSX, add it to the header row. Place it at the far right of the top bar, after the DateRangePicker:

```tsx
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
  <CSVImporter />
  <AddDataDialog ... />
  <div className="hidden sm:block mx-2 bg-border w-[1px] h-8" />
  <DateRangePicker />
  <div className="hidden sm:block mx-2 bg-border w-[1px] h-8" />
  <UserMenu />
</div>
```

**Step 3: Commit**

```bash
git add components/user-menu.tsx app/page.tsx
git commit -m "feat: add user menu with profile badge and sign out"
```

---

### Task 11: Add shadcn dropdown-menu component (if missing)

**Files:**
- Possibly create: `components/ui/dropdown-menu.tsx`

**Step 1: Check if dropdown-menu exists**

Run:
```bash
ls components/ui/dropdown-menu.tsx
```

**Step 2: If missing, install it**

Run:
```bash
npx shadcn@latest add dropdown-menu
```

**Step 3: Commit (if changes were made)**

```bash
git add components/ui/dropdown-menu.tsx
git commit -m "feat: add dropdown-menu shadcn component"
```

---

### Task 12: Update SessionProvider in layout (if needed)

**Files:**
- Modify: `app/layout.tsx`

Auth.js v5 with the database strategy does NOT require a SessionProvider wrapper for server components. Since the app primarily uses server components and server actions, no changes needed to `layout.tsx` for session management.

However, if the onboarding page (client component) needs session data, it should fetch it via a server action or API call rather than using `useSession()`.

**Step 1: Verify the app builds**

Run:
```bash
npm run build
```

Fix any type errors or import issues.

**Step 2: Commit any fixes**

```bash
git add .
git commit -m "fix: resolve build errors after auth integration"
```

---

### Task 13: Test the full flow end-to-end

**Step 1: Set up Google OAuth credentials**

Go to Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID.
Set authorized redirect URI to: `http://localhost:3000/api/auth/callback/google`

Add the credentials to `.env.local`:
```
AUTH_GOOGLE_ID=your-client-id
AUTH_GOOGLE_SECRET=your-client-secret
```

**Step 2: Run dev server and test**

Run:
```bash
npm run dev
```

Test the following flow:
1. Visit `http://localhost:3000` → should redirect to `/login`
2. Click "Sign in with Google" → complete OAuth flow
3. Should redirect to `/onboarding` → pick a profile type
4. Should redirect to `/` → see empty dashboard (new user, no data)
5. Add some data → verify it persists and is scoped to your user
6. Check the user menu shows your name, email, profile badge
7. Sign out → verify redirect to login

**Step 3: Test data isolation**

Sign in with a different Google account and verify the second account cannot see the first account's data.

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete multi-account auth with google sign-in"
```
