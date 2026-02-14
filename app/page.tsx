import { DashboardTab } from "@/components/dashboard-tab";
import { DateRangePicker } from "@/components/date-range-picker";
import { TransactionsTab } from "@/components/transactions-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { between } from "drizzle-orm";
import { startOfMonth, endOfMonth } from "date-fns";
import { ProjectsTab } from "@/components/projects-tab";
import { SalaryTab } from "@/components/salary-tab";
import { MaintenanceTab } from "@/components/maintenance-tab";
import { AddDataDialog } from "@/components/add-data-dialog";
import { CSVImporter } from "@/components/csv-importer"; // Importamos el cargador inteligente

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  // 1. Desvolvemos la promesa de searchParams (Estándar Next.js 16)
  const params = await searchParams;

  // Obtenemos data necesaria para el diálogo de carga manual
  const [allClients, allProjects] = await Promise.all([
    db.query.clients.findMany(),
    db.query.projects.findMany(),
  ]);

  // 2. Definimos el rango de fechas para el filtrado global
  const fromDate = params.from
    ? new Date(params.from)
    : startOfMonth(new Date());

  const toDate = params.to ? new Date(params.to) : endOfMonth(new Date());

  // 3. Consulta a Turso filtrada para los gráficos del Dashboard
  const allTransactions = await db.query.transactions.findMany({
    where: between(transactions.date, fromDate, toDate),
  });

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header Global con Herramientas de Carga y Filtro */}
      <div className="flex justify-between items-center">
        <h1 className="font-bold text-3xl tracking-tight">
          Freelance Dashboard
        </h1>
        <div className="flex items-center gap-4">
          {/* Herramientas de entrada de datos agrupadas */}
          <CSVImporter />
          <AddDataDialog clientsData={allClients} projectsData={allProjects} />
          <div className="mx-2 bg-border w-[1px] h-8" />{" "}
          {/* Separador visual */}
          <DateRangePicker />
        </div>
      </div>

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
          <TransactionsTab from={fromDate} to={toDate} />
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
