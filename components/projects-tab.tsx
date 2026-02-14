import { db } from "@/db";
import { projects, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
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

export async function ProjectsTab() {
  // Traemos proyectos con sus transacciones asociadas
  const allProjects = await db.query.projects.findMany({
    with: {
      transactions: true,
      client: true,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-xl">Seguimiento de Proyectos</h2>
      </div>

      <div className="bg-white border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto / Cliente</TableHead>
              <TableHead>Presupuesto</TableHead>
              <TableHead>Cobrado</TableHead>
              <TableHead>Progreso</TableHead>
              <TableHead className="text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allProjects.map((project) => {
              const totalPaid = project.transactions.reduce(
                (acc, t) => acc + t.amount,
                0,
              );
              const remaining = project.totalAmount - totalPaid;
              const progressPercentage = Math.min(
                (totalPaid / project.totalAmount) * 100,
                100,
              );

              // Lógica de estados
              let statusLabel = "Esperando Pago";
              let statusColor = "bg-red-100 text-red-700 border-red-200";

              if (totalPaid >= project.totalAmount) {
                statusLabel = "Pagado Total";
                statusColor = "bg-green-100 text-green-700 border-green-200";
              } else if (totalPaid > 0) {
                statusLabel = "Falta Saldo";
                statusColor = "bg-yellow-100 text-yellow-700 border-yellow-200";
              }

              return (
                <TableRow key={project.id}>
                  <TableCell>
                    <div className="font-medium">{project.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {project.client?.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    ${project.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-green-600">
                    ${totalPaid.toLocaleString()}
                  </TableCell>
                  <TableCell className="w-[200px]">
                    <div className="flex flex-col gap-1">
                      <Progress value={progressPercentage} className="h-2" />
                      <span className="text-[10px] text-muted-foreground text-right">
                        {progressPercentage.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={statusColor}>
                      {statusLabel}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
