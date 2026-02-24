"use client";

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RowActions } from "./tables/row-actions";
import { type InferSelectModel } from "drizzle-orm";
import { projects, clients, transactions } from "@/db/schema";

type Client = InferSelectModel<typeof clients>;
type Transaction = InferSelectModel<typeof transactions>;
type Project = InferSelectModel<typeof projects> & {
  client: Client | null;
  transactions: Transaction[];
};

export function ProjectsTab({
  projects,
  clients,
}: {
  projects: Project[];
  clients: Client[];
}) {
  const [showFinished, setShowFinished] = useState(false);

  // Calcula totales y filtra 
  const processedProjects = projects
    .map((project) => {
      const totalPaid = project.transactions.reduce(
        (acc, t) => acc + t.amount,
        0,
      );
      return { ...project, totalPaid };
    })
    .filter((project) => {
      if (showFinished) return true; // Mostrar todos
      // "No finalizado" si: State no es finalizado Y (no pagó el 100% o el estado sigue siendo default)
      return (
        project.status !== "finalizado" && project.totalPaid < project.totalAmount
      );
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="font-semibold text-xl">Seguimiento de Proyectos</h2>
        <div className="flex items-center space-x-2">
          <Switch
            id="show-finished"
            checked={showFinished}
            onCheckedChange={setShowFinished}
          />
          <Label htmlFor="show-finished" className="font-normal text-muted-foreground whitespace-nowrap">
            Mostrar Finalizados
          </Label>
        </div>
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
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedProjects.map((project) => {
              const { totalPaid } = project;
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
                  <TableCell>
                    <RowActions row={project} type="project" clients={clients} />
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
