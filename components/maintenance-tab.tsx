import { db } from "@/db";
import { transactions, recurringServices } from "@/db/schema";
import { eq, and, between } from "drizzle-orm";
import { format, isSameMonth } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export async function MaintenanceTab({ from, to }: { from: Date; to: Date }) {
  // 1. Traemos todos los servicios de tipo mantenimiento y sus clientes
  const services = await db.query.recurringServices.findMany({
    where: eq(recurringServices.type, "maintenance"),
    with: {
      client: true,
    },
  });

  // 2. Traemos las transacciones de mantenimiento en el rango (por fecha imputada)
  const maintenanceTransactions = await db.query.transactions.findMany({
    where: and(
      eq(transactions.category, "maintenance"),
      between(transactions.imputedDate, from, to),
    ),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-xl">Estado de Mantenimientos</h2>
      </div>

      <div className="bg-white border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente / Servicio</TableHead>
              <TableHead>Abono Mensual</TableHead>
              <TableHead>Total Cobrado</TableHead>
              <TableHead className="text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-muted-foreground text-center"
                >
                  No hay servicios de mantenimiento configurados.
                </TableCell>
              </TableRow>
            ) : (
              services.map((service) => {
                // Sumamos lo cobrado para este servicio específico en el rango
                const totalCollected = maintenanceTransactions
                  .filter((t) => t.serviceId === service.id)
                  .reduce((acc, t) => acc + t.amount, 0);

                const isPaid = totalCollected >= service.amount;

                return (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div className="font-medium">{service.client?.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {service.name}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${service.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium text-purple-700">
                      ${totalCollected.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {isPaid ? (
                        <Badge className="bg-green-100 border-green-200 text-green-700">
                          Al día
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 border-red-200 text-red-700">
                          Pendiente
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
