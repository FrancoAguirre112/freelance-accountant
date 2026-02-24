"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientCombobox } from "@/components/client-combobox";
import {
  deleteTransactionAction,
  deleteProjectAction,
  deleteRecurringServiceAction,
  updateTransactionAction,
  updateProjectAction,
  updateRecurringServiceAction,
} from "@/app/actions";
import { type InferSelectModel } from "drizzle-orm";
import {
  transactions,
  projects,
  recurringServices,
  clients,
} from "@/db/schema";

// 1. Definimos los tipos exactos desde la base de datos
type Transaction = InferSelectModel<typeof transactions>;
type Project = InferSelectModel<typeof projects>;
type RecurringService = InferSelectModel<typeof recurringServices>;
type Client = InferSelectModel<typeof clients>;
type TransactionCategory = "project" | "salary" | "maintenance" | "other";

// 2. Creamos una unión discriminada para los props
// Esto le dice a TS: "Si type es 'transaction', row TIENE que ser una Transaction"
type RowActionsProps =
  | {
      type: "transaction";
      row: Transaction;
      clients?: Client[];
      projects?: Project[];
    }
  | { type: "project"; row: Project; clients?: Client[]; projects?: Project[] }
  | {
      type: "recurring";
      row: RecurringService;
      clients?: Client[];
      projects?: Project[];
    };

export function RowActions({ row, type, clients, projects }: RowActionsProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de que quieres eliminar esto?")) return;

    let res;
    // TS sabe que 'row' tiene 'id' en todos los casos
    if (type === "transaction") res = await deleteTransactionAction(row.id);
    if (type === "project") res = await deleteProjectAction(row.id);
    if (type === "recurring") res = await deleteRecurringServiceAction(row.id);

    if (res?.success) toast.success("Eliminado correctamente");
    else toast.error("Error al eliminar");
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    let res;

    // TS infiere automáticamente el tipo de 'row' dentro de cada bloque if
    if (type === "transaction") {
      res = await updateTransactionAction(row.id, {
        date: new Date(formData.get("date") as string),
        amount: parseFloat(formData.get("amount") as string),
        description: formData.get("description") as string,
        // 3. Tipado seguro para la categoría
        category: formData.get("category") as TransactionCategory,
      });
    } else if (type === "project") {
      res = await updateProjectAction(row.id, {
        name: formData.get("name") as string,
        clientId: parseInt(formData.get("clientId") as string),
        totalAmount: parseFloat(formData.get("totalAmount") as string),
        status: formData.get("status") as string,
      });
    } else if (type === "recurring") {
      res = await updateRecurringServiceAction(row.id, {
        name: formData.get("name") as string,
        amount: parseFloat(formData.get("amount") as string),
      });
    }

    if (res?.success) {
      toast.success("Actualizado correctamente");
      setIsEditOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="p-0 w-8 h-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
            <Pencil className="mr-2 w-4 h-4" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} className="text-red-600">
            <Trash className="mr-2 w-4 h-4" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar{" "}
              {type === "transaction"
                ? "Transacción"
                : type === "project"
                  ? "Proyecto"
                  : "Servicio"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            {/* CAMPOS DE TRANSACCIÓN */}
            {/* Al comprobar type === "transaction", TS sabe que 'row' es Transaction */}
            {type === "transaction" && (
              <>
                <div className="gap-4 grid grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input
                      name="date"
                      type="date"
                      defaultValue={
                        row.date
                          ? new Date(row.date).toISOString().split("T")[0]
                          : ""
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monto</Label>
                    <Input
                      name="amount"
                      type="number"
                      step="0.01"
                      defaultValue={row.amount}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select name="category" defaultValue={row.category}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Proyecto</SelectItem>
                      <SelectItem value="salary">Sueldo</SelectItem>
                      <SelectItem value="maintenance">Mantenimiento</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Input
                    name="description"
                    defaultValue={row.description || ""}
                  />
                </div>
              </>
            )}

            {/* CAMPOS DE PROYECTO */}
            {type === "project" && (
              <>
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input name="name" defaultValue={row.name} required />
                </div>
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <ClientCombobox
                    clients={clients || []}
                    name="clientId"
                    defaultValue={row.clientId?.toString()}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Presupuesto Total</Label>
                  <Input
                    name="totalAmount"
                    type="number"
                    step="0.01"
                    defaultValue={row.totalAmount}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    name="status"
                    defaultValue={row.status || "en_desarrollo"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en_desarrollo">
                        En Desarrollo
                      </SelectItem>
                      <SelectItem value="finalizado">Finalizado</SelectItem>
                      <SelectItem value="pausado">Pausado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* CAMPOS DE RECURRENTE */}
            {type === "recurring" && (
              <>
                <div className="space-y-2">
                  <Label>Nombre del Servicio</Label>
                  <Input name="name" defaultValue={row.name} required />
                </div>
                <div className="space-y-2">
                  <Label>Monto Objetivo Mensual</Label>
                  <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    defaultValue={row.amount}
                    required
                  />
                </div>
              </>
            )}

            <Button type="submit" className="w-full">
              Guardar Cambios
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
