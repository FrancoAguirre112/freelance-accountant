import { db } from "@/db";
import { transactions, recurringServices } from "@/db/schema";
import { eq, and, between } from "drizzle-orm";
import {
  format,
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  isSameMonth,
} from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export async function SalaryTab({ from, to }: { from: Date; to: Date }) {
  // 1. Obtenemos el "contrato" de sueldo (ej: RTN $400)
  const salaryContract = await db.query.recurringServices.findFirst({
    where: eq(recurringServices.type, "salary"),
  });

  // 2. Obtenemos todas las transacciones de sueldo en el rango (usando fecha imputada)
  const salaryTransactions = await db.query.transactions.findMany({
    where: and(
      eq(transactions.category, "salary"),
      between(transactions.imputedDate, from, to),
    ),
  });

  // 3. Generamos la lista de meses a mostrar basándonos en el filtro global
  const monthsInRange = eachMonthOfInterval({ start: from, end: to });

  const monthlyTarget = salaryContract?.amount || 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-xl">Cobertura de Sueldo (RTN)</h2>
        <div className="text-muted-foreground text-sm">
          Objetivo mensual:{" "}
          <span className="font-bold text-foreground">${monthlyTarget}</span>
        </div>
      </div>

      <div className="bg-white border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mes Contable</TableHead>
              <TableHead>Monto Recibido</TableHead>
              <TableHead>Estado de Cobertura</TableHead>
              <TableHead className="text-right">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthsInRange.map((month) => {
              // Sumamos lo recibido para ESTE mes específico
              const amountReceived = salaryTransactions
                .filter(
                  (t) => t.imputedDate && isSameMonth(t.imputedDate, month),
                )
                .reduce((acc, t) => acc + t.amount, 0);

              const isCovered = amountReceived >= monthlyTarget;
              const isPartial =
                amountReceived > 0 && amountReceived < monthlyTarget;

              return (
                <TableRow key={month.toISOString()}>
                  <TableCell className="font-medium capitalize">
                    {format(month, "MMMM yyyy")}
                  </TableCell>
                  <TableCell className="font-semibold">
                    ${amountReceived.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {isCovered ? (
                      <Badge className="bg-green-100 border-green-200 text-green-700">
                        Cubierto
                      </Badge>
                    ) : isPartial ? (
                      <Badge className="bg-yellow-100 border-yellow-200 text-yellow-700">
                        Parcial
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 border-red-200 text-red-700">
                        Pendiente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs text-right">
                    {isCovered
                      ? "Meta alcanzada"
                      : `Faltan $${(monthlyTarget - amountReceived).toLocaleString()}`}
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
