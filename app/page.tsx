import { DashboardTab } from "@/components/dashboard-tab";
import { DateRangePicker } from "@/components/date-range-picker";
import { TransactionsTab } from "@/components/transactions-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { transactions, clients, projects } from "@/db/schema";
import { between, eq, desc } from "drizzle-orm";
import { startOfMonth, endOfMonth } from "date-fns";
import { ProjectsTab } from "@/components/projects-tab";
import { SalaryTab } from "@/components/salary-tab";
import { MaintenanceTab } from "@/components/maintenance-tab";
import { AddDataDialog } from "@/components/add-data-dialog";
import { CSVImporter } from "@/components/csv-importer";
import { ClientsDatabaseDialog } from "@/components/clients-database-dialog";
import { ActiveFilters } from "@/components/active-filters";
import { FiltersDialog } from "@/components/filters-dialog";

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

  const [allClients, allProjects] = await Promise.all([
    db.query.clients.findMany(),
    db.query.projects.findMany(),
  ]);

  const activeClients = allClients.filter((c) => c.status === "active");
  const activeProjects = allProjects.filter(
    (p) => p.status === "en_desarrollo",
  );

  // --- FIX DE ZONA HORARIA ---
  // Usamos T12:00:00 para caer en el mediodía y evitar saltos de día por GMT
  const fromDate = params.from
    ? new Date(params.from + "T12:00:00")
    : startOfMonth(new Date());

  const toDate = params.to
    ? new Date(params.to + "T12:00:00")
    : endOfMonth(new Date());

  // 3. Consulta Maestra
  let allTransactions = await db.query.transactions.findMany({
    where: between(transactions.date, fromDate, toDate),
    with: {
      project: { with: { client: true } },
      service: { with: { client: true } },
    },
    orderBy: [desc(transactions.date)],
  });

  // --- 4. LÓGICA DE FILTRADO COMBINABLE ---
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
    <div className="flex flex-col gap-8 p-8">
      <div className="flex justify-between items-center">
        <h1 className="font-bold text-3xl tracking-tight">
          Freelance Dashboard
        </h1>
        <div className="flex items-center gap-4">
          <ClientsDatabaseDialog clients={allClients} />
          <FiltersDialog clients={allClients} projects={allProjects} />
          <div className="mx-2 bg-border w-[1px] h-8" />
          <CSVImporter />
          <AddDataDialog
            clientsData={activeClients}
            projectsData={activeProjects}
          />
          <div className="mx-2 bg-border w-[1px] h-8" />
          <DateRangePicker />
        </div>
      </div>

      <ActiveFilters clients={allClients} projects={allProjects} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Dashboard</TabsTrigger>
          <TabsTrigger value="transactions">Movimientos</TabsTrigger>
          <TabsTrigger value="projects">Proyectos</TabsTrigger>
          <TabsTrigger value="salary">Sueldos (RTN)</TabsTrigger>
          <TabsTrigger value="maintenance">Mantenimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <DashboardTab data={allTransactions} />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsTab
            from={fromDate}
            to={toDate}
            preFilteredData={allTransactions}
          />
        </TabsContent>

        <TabsContent value="projects">
          <ProjectsTab />
        </TabsContent>

        <TabsContent value="salary">
          <SalaryTab from={fromDate} to={toDate} />
        </TabsContent>

        <TabsContent value="maintenance">
          <MaintenanceTab from={fromDate} to={toDate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
