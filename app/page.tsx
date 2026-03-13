import { auth } from "@/auth";
import { DashboardTab } from "@/components/dashboard-tab";
import { DateRangePicker } from "@/components/date-range-picker";
import { TransactionsTab } from "@/components/transactions-tab";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActiveTabProvider } from "@/components/active-tab-context";
import { SyncedTabs } from "@/components/synced-tabs";
import { UserMenu } from "@/components/user-menu";
import { db } from "@/db";
import { clients, presupuestos, recurringServices, transactions } from "@/db/schema";
import { eq, and, between, desc } from "drizzle-orm";
import { PresupuestosTab } from "@/components/presupuestos-tab";
import { MaintenanceTab } from "@/components/maintenance-tab";
import { AddDataDialog } from "@/components/add-data-dialog";
import { ClientsDatabaseDialog } from "@/components/clients-database-dialog";
import Image from "next/image";
import { Montserrat } from "next/font/google";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChangelogButton } from "@/components/update-notification";
import { MobileNav } from "@/components/mobile-nav";
import { SettingsDialog } from "@/components/settings-dialog";


// 2. Initialize Montserrat with the 'Black' weight (900)
const montserrat = Montserrat({ 
  subsets: ["latin"],
  weight: "900" 
});

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;

  const session = await auth();
  const userId = session!.user.id;

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

  const activeClients = allClients.filter((c) => c.status === "active");
  const activePresupuestos = allPresupuestos.filter(
    (p) => p.status === "activo",
  );
  const activeServices = allServices;

  // --- 1. QUERY DATES (Exact Boundaries for Database) ---
  // We need 00:00 to 23:59 to catch ALL transactions safely
  const now = new Date();
  const queryFrom = params.from
    ? new Date(params.from + "T00:00:00Z")
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const queryTo = params.to
    ? new Date(params.to + "T23:59:59.999Z")
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  // --- 2. DISPLAY DATES (Safe Noon for UI Components) ---
  // We force these to 12:00 PM UTC so they don't shift to the previous day
  // when the browser applies the local timezone (e.g. GMT-3).
  const displayFrom = new Date(queryFrom);
  displayFrom.setUTCHours(12, 0, 0, 0);

  const displayTo = new Date(queryTo);
  displayTo.setUTCHours(12, 0, 0, 0);

  // 3. FETCH TRANSACTIONS (Using QUERY dates)
  const rawTransactions = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      between(transactions.date, queryFrom, queryTo),
    ),
    with: {
      presupuesto: { with: { client: true } },
      service: { with: { client: true } },
    },
    orderBy: [desc(transactions.date)],
  });

  // 4. NORMALIZE OUTPUT (For Dashboard/Transactions List)
  const allTransactions = rawTransactions.map((t) => {
    const safeDate = new Date(t.date);
    safeDate.setUTCHours(12, 0, 0, 0); // Force Noon UTC for display

    const safeImputed = t.imputedDate
      ? new Date(t.imputedDate)
      : new Date(t.date);
    safeImputed.setUTCHours(12, 0, 0, 0);

    return {
      ...t,
      date: safeDate,
      imputedDate: safeImputed,
    };
  });

  return (
    <ActiveTabProvider>
    <div className="flex flex-col gap-8 p-4 md:p-8 overflow-hidden w-full">
      {/* Mobile header */}
      <div className="flex md:hidden items-center gap-2">
        <MobileNav
          userMenu={<UserMenu expand />}
          entidadesButton={<ClientsDatabaseDialog clients={allClients} />}
        />
      </div>

      {/* Desktop header */}
      <div className="hidden md:flex flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/Flogo.webp"
            alt="Logo"
            width={500}
            height={500}
            className="w-10 h-10"
          />
          <h1 className={`${montserrat.className} text-[40px] leading-[40px] tracking-tight`}>
            Fiscus
          </h1>
        </div>

        <div className="flex items-center gap-2 w-auto overflow-x-auto">
          <AddDataDialog
            clientsData={activeClients}
            presupuestosData={activePresupuestos}
            servicesData={activeServices}
          />
          <ClientsDatabaseDialog clients={allClients} />
          <div className="mx-1 bg-border w-[1px] h-8 shrink-0" />
          <ChangelogButton />
          <SettingsDialog />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      <SyncedTabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-col md:flex-row justify-between bg-transparent p-0 w-full h-auto gap-4 md:gap-0">
          <div className="hidden md:flex bg-muted p-1 rounded-md overflow-x-auto w-auto whitespace-nowrap">
            <TabsTrigger value="overview">Dashboard</TabsTrigger>
            <TabsTrigger value="transactions">Movimientos</TabsTrigger>
            <TabsTrigger value="presupuestos">Presupuestos</TabsTrigger>
            <TabsTrigger value="maintenance">Recurrentes</TabsTrigger>
          </div>
          <DateRangePicker />
        </TabsList>

        <TabsContent value="overview">
          <DashboardTab
            data={allTransactions}
            presupuestos={allPresupuestos}
            clients={allClients}
            services={allServices}
          />
        </TabsContent>

        <TabsContent value="transactions">
          {/* We pass DISPLAY dates to tabs, but filtered data is already there */}
          <TransactionsTab
            from={displayFrom}
            to={displayTo}
            preFilteredData={allTransactions}
          />
        </TabsContent>

        <TabsContent value="presupuestos">
          <PresupuestosTab presupuestos={allPresupuestos} clients={allClients} />
        </TabsContent>

        <TabsContent value="maintenance">
          <MaintenanceTab
            from={displayFrom}
            to={displayTo}
            clients={allClients}
            transactions={allTransactions}
            services={allServices}
          />
        </TabsContent>
      </SyncedTabs>

      {/* Mobile FAB */}
      <div className="fixed bottom-6 right-6 z-50 md:hidden">
        <AddDataDialog
          clientsData={activeClients}
          presupuestosData={activePresupuestos}
          servicesData={activeServices}
          fabMode
        />
      </div>
    </div>
    </ActiveTabProvider>
  );
}