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
  TableRow, // Corregido: Shadcn utiliza TableRow
} from "@/components/ui/table";
import { CSVImporter } from "./csv-importer";
import { Badge } from "@/components/ui/badge";

// Definimos el tipo de categoría basado en los valores permitidos en tu esquema
type TransactionCategory = "project" | "salary" | "maintenance" | "other";

export async function TransactionsTab({ from, to }: { from: Date; to: Date }) {
  // Consulta a Turso filtrada por el rango del calendario
  const data = await db.query.transactions.findMany({
    where: between(transactions.date, from, to),
    orderBy: [desc(transactions.date)],
  });

  // Tipamos el objeto de colores usando Record con nuestra unión de categorías
  const categoryColors: Record<TransactionCategory, string> = {
    maintenance: "bg-purple-100 text-purple-700 border-purple-200", // Violeta
    project: "bg-blue-100 text-blue-700 border-blue-200", // Azul
    salary: "bg-green-100 text-green-700 border-green-200", // Verde
    other: "bg-gray-100 text-gray-700 border-gray-200", // Gris
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
              <TableHead>Categoría</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Monto (USD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-muted-foreground text-center"
                >
                  No hay movimientos en este rango de fechas.
                </TableCell>
              </TableRow>
            ) : (
              data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{format(t.date, "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        categoryColors[t.category as TransactionCategory]
                      }
                    >
                      {t.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{t.description}</TableCell>
                  <TableCell className="font-bold text-green-600 text-right">
                    + ${t.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
