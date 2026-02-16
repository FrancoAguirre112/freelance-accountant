import { db } from "@/db";
import { transactions } from "@/db/schema";
import { between, desc } from "drizzle-orm";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RowActions } from "@/components/tables/row-actions";
import { type InferSelectModel } from "drizzle-orm";

// 1. Define a more flexible type for the joined data
// We extend the base transaction model to include optional relation properties
type TransactionModel = InferSelectModel<typeof transactions>;

interface TransactionWithRelations extends TransactionModel {
  project?: {
    name: string;
    client?: { name: string } | null;
  } | null;
  service?: {
    name: string;
    client?: { name: string } | null;
  } | null;
}

type TransactionCategory = "project" | "salary" | "maintenance" | "other";

export async function TransactionsTab({
  from,
  to,
  preFilteredData,
}: {
  from: Date;
  to: Date;
  preFilteredData?: any[]; // Relaxed type here to accept the Drizzle result directly
}) {
  let data: TransactionWithRelations[];

  if (preFilteredData) {
    // We cast the pre-filtered data to our interface
    data = preFilteredData as TransactionWithRelations[];
  } else {
    // 2. Fallback query
    const result = await db.query.transactions.findMany({
      where: between(transactions.date, from, to),
      with: {
        project: { with: { client: true } },
        service: { with: { client: true } },
      },
      orderBy: [desc(transactions.date)],
    });
    data = result as TransactionWithRelations[];
  }

  const categoryColors: Record<TransactionCategory, string> = {
    maintenance: "bg-purple-100 text-purple-700 border-purple-200",
    project: "bg-blue-100 text-blue-700 border-blue-200",
    salary: "bg-green-100 text-green-700 border-green-200",
    other: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-xl">Historial de Movimientos</h2>
      </div>

      <div className="bg-white border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha Real</TableHead>
              <TableHead>Cliente / Origen</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Monto (USD)</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-muted-foreground text-center"
                >
                  No hay movimientos en este rango de fechas.
                </TableCell>
              </TableRow>
            ) : (
              data.map((t) => {
                // Determine Client and Source names safely
                const clientName =
                  t.project?.client?.name ||
                  t.service?.client?.name ||
                  "Sin Cliente";

                const sourceName =
                  t.project?.name || t.service?.name || "Movimiento Directo";

                return (
                  <TableRow key={t.id}>
                    <TableCell className="min-w-[100px]">
                      {format(t.date, "dd/MM/yyyy")}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {clientName}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {sourceName}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          categoryColors[t.category as TransactionCategory] ||
                          categoryColors.other
                        }
                      >
                        {t.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-muted-foreground">
                      {t.description || "-"}
                    </TableCell>
                    <TableCell className="font-bold text-green-600 text-right">
                      + ${t.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <RowActions row={t} type="transaction" />
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
