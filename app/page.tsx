import { DashboardTab } from "@/components/dashboard-tab";
import { DateRangePicker } from "@/components/date-range-picker";
import { TransactionsTab } from "@/components/transactions-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { between, desc } from "drizzle-orm";
import { startOfMonth, endOfMonth } from "date-fns";
import { ProjectsTab } from "@/components/projects-tab";
import { SalaryTab } from "@/components/salary-tab";
import { MaintenanceTab } from "@/components/maintenance-tab";
import { AddDataDialog } from "@/components/add-data-dialog";
import { CSVImporter } from "@/components/csv-importer";
import { ClientsDatabaseDialog } from "@/components/clients-database-dialog";
import { ActiveFilters } from "@/components/active-filters";
import { FiltersDialog } from "@/components/filters-dialog";
import Image from "next/image";
import { Montserrat } from "next/font/google"; // <-- 1. Import the font

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
    clientId?: string;
    projectId?: string;
    category?: string;
    type?: string;
  }>;
}) {
  const params = await searchParams;

  const [allClients, allProjects, allServices] = await Promise.all([
    db.query.clients.findMany(),
    db.query.projects.findMany({
      with: {
        client: true,
        transactions: true,
      },
    }),
    db.query.recurringServices.findMany({
      with: {
        client: true,
      },
    }),
  ]);

  const activeClients = allClients.filter((c) => c.status === "active");
  const activeProjects = allProjects.filter(
    (p) => p.status === "en_desarrollo",
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
    where: between(transactions.date, queryFrom, queryTo),
    with: {
      project: { with: { client: true } },
      service: { with: { client: true } },
    },
    orderBy: [desc(transactions.date)],
  });

  // 4. NORMALIZE OUTPUT (For Dashboard/Transactions List)
  let allTransactions = rawTransactions.map((t) => {
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

  // --- 5. FILTERING LOGIC ---
  if (params.clientId) {
    const filterId = parseInt(params.clientId);
    allTransactions = allTransactions.filter((t) => {
      const projectClientId = t.project?.clientId;
      const serviceClientId = t.service?.clientId;
      return projectClientId === filterId || serviceClientId === filterId;
    });
  }

  if (params.projectId) {
    const filterId = parseInt(params.projectId);
    allTransactions = allTransactions.filter((t) => t.projectId === filterId);
  }

  if (params.category) {
    allTransactions = allTransactions.filter(
      (t) => t.category === params.category,
    );
  }

  if (params.type) {
    allTransactions = allTransactions.filter((t) => {
      if (t.category === params.type) return true;
      if (t.service?.type === params.type) return true;
      return false;
    });
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 overflow-hidden w-full">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          <CSVImporter />
          <AddDataDialog
            clientsData={activeClients}
            projectsData={activeProjects}
            servicesData={activeServices}
          />
          <div className="hidden sm:block mx-2 bg-border w-[1px] h-8" />
          <DateRangePicker />
        </div>
      </div>

      <ActiveFilters clients={allClients} projects={allProjects} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-col md:flex-row justify-between bg-transparent p-0 w-full h-auto gap-4 md:gap-0">
          <div className="flex bg-muted p-1 rounded-md overflow-x-auto w-full md:w-auto whitespace-nowrap">
            <TabsTrigger value="overview">Dashboard</TabsTrigger>
            <TabsTrigger value="transactions">Movimientos</TabsTrigger>
            <TabsTrigger value="projects">Proyectos</TabsTrigger>
            <TabsTrigger value="salary">Sueldos (RTN)</TabsTrigger>
            <TabsTrigger value="maintenance">Mantenimientos</TabsTrigger>
          </div>

          <div className="flex gap-2 w-full md:w-auto overflow-x-auto whitespace-nowrap">
            <ClientsDatabaseDialog clients={allClients} />
            <FiltersDialog clients={allClients} projects={allProjects} />
          </div>
        </TabsList>

        <TabsContent value="overview">
          <DashboardTab data={allTransactions} />
        </TabsContent>

        <TabsContent value="transactions">
          {/* We pass DISPLAY dates to tabs, but filtered data is already there */}
          <TransactionsTab
            from={displayFrom}
            to={displayTo}
            preFilteredData={allTransactions}
          />
        </TabsContent>

        <TabsContent value="projects">
          <ProjectsTab projects={allProjects} clients={allClients} />
        </TabsContent>

        <TabsContent value="salary">
          {/* IMPORTANT: Passing display dates (Noon) prevents the December 2025 bug */}
          <SalaryTab
            from={displayFrom}
            to={displayTo}
            transactions={allTransactions}
            services={allServices}
          />
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
      </Tabs>
    </div>
  );
}