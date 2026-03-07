"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, RefreshCw, Trash } from "lucide-react";
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
  deletePresupuestoAction,
  deleteRecurringServiceAction,
  updateTransactionAction,
  updatePresupuestoAction,
  updateRecurringServiceAction,
  createRecurringServiceAction,
  createRecurringFromPresupuestoAction,
} from "@/app/actions";
import { type InferSelectModel } from "drizzle-orm";
import {
  transactions,
  presupuestos,
  recurringServices,
  clients,
} from "@/db/schema";

type Transaction = InferSelectModel<typeof transactions>;
type Presupuesto = InferSelectModel<typeof presupuestos>;
type RecurringService = InferSelectModel<typeof recurringServices>;
type Client = InferSelectModel<typeof clients>;
type TransactionCategory = "presupuesto" | "recurring" | "other";

type RowActionsProps =
  | {
      type: "transaction";
      row: Transaction;
      clients?: Client[];
    }
  | { type: "presupuesto"; row: Presupuesto; clients?: Client[] }
  | {
      type: "recurring";
      row: RecurringService;
      clients?: Client[];
    };

export function RowActions({ row, type, clients }: RowActionsProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de que quieres eliminar esto?")) return;

    let res;
    // TS sabe que 'row' tiene 'id' en todos los casos
    if (type === "transaction") res = await deleteTransactionAction(row.id);
    if (type === "presupuesto") res = await deletePresupuestoAction(row.id);
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
    } else if (type === "presupuesto") {
      res = await updatePresupuestoAction(row.id, {
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

  const handleConvert = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (type !== "presupuesto") return;

    const formData = new FormData(e.currentTarget);
    let res;

    if (type === "presupuesto") {
      if (row.type === "ingreso") {
        const client = clients?.find((c) => c.id === row.clientId);
        if (!client) {
          toast.error("Error al identificar la entidad");
          return;
        }
        res = await createRecurringServiceAction({
          name: formData.get("name") as string,
          clientName: client.name,
          amount: parseFloat(formData.get("amount") as string),
        });
      } else {
        res = await createRecurringFromPresupuestoAction({
          name: formData.get("name") as string,
          clientId: row.clientId!,
          amount: parseFloat(formData.get("amount") as string),
        });
      }
    }

    if (res?.success) {
      toast.success("Operación recurrente creada con éxito");
      setIsConvertOpen(false);
    } else {
      toast.error("Error al crear la operación recurrente");
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
          <DropdownMenuItem onClick={() => { setEditKey((k) => k + 1); setIsEditOpen(true); }}>
            <Pencil className="mr-2 w-4 h-4" /> Editar
          </DropdownMenuItem>
          {type === "presupuesto" && (
            <DropdownMenuItem
              onClick={() => setIsConvertOpen(true)}
              className="text-blue-600 focus:text-blue-600"
            >
              <RefreshCw className="mr-2 w-4 h-4" /> Convertir a Recurrente
            </DropdownMenuItem>
          )}
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
                : type === "presupuesto"
                  ? "Presupuesto"
                  : "Servicio"}
            </DialogTitle>
          </DialogHeader>
          <form key={editKey} onSubmit={handleUpdate} className="space-y-4">
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
                      <SelectItem value="recurring">Recurrente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
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

            {/* CAMPOS DE PRESUPUESTO */}
            {type === "presupuesto" && (
              <>
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input name="name" defaultValue={row.name} required />
                </div>
                <div className="space-y-2">
                  <Label>Entidad</Label>
                  <ClientCombobox
                    clients={clients || []}
                    name="clientId"
                    defaultValue={row.clientId?.toString()}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monto Total</Label>
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
                  <Select name="status" defaultValue={row.status || "activo"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
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
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir a Recurrente</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {type === "presupuesto" && row.type === "egreso"
              ? "Se creará un pago recurrente (egreso) para esta entidad."
              : "Se creará un servicio recurrente (ingreso) para esta entidad."}
          </p>
          <form onSubmit={handleConvert} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la Operación</Label>
              <Input
                name="name"
                defaultValue={type === "presupuesto" ? row.name : ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Monto Mensual (USD)</Label>
              <Input
                name="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Activar Recurrencia
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
