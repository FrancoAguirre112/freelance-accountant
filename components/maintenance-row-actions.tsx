"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
  updateRecurringServiceAction,
  deleteRecurringServiceAction,
} from "@/app/actions";

interface Client {
  id: number;
  name: string;
}

interface MaintenanceService {
  serviceId: number;
  serviceName: string;
  serviceType: string;
  monthlyFee: number;
  clientId: number | null;
  clientName: string;
}

export function MaintenanceRowActions({
  service,
  clients,
}: {
  service: MaintenanceService;
  clients: Client[];
}) {
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  // --- HANDLERS ---
  const handleDelete = async () => {
    const res = await deleteRecurringServiceAction(service.serviceId);
    if (res.success) {
      toast.success("Operación eliminada correctamente");
    } else {
      toast.error("Error al eliminar");
    }
    setIsDeleteOpen(false);
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const res = await updateRecurringServiceAction(service.serviceId, {
      name: formData.get("name") as string,
      amount: parseFloat(formData.get("amount") as string),
      clientId: Number(formData.get("clientId")),
      type: formData.get("type") as "service" | "payment",
    });

    if (res.success) {
      toast.success("Operación actualizada");
      setIsEditOpen(false);
    } else {
      toast.error("Error al actualizar");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="p-0 w-8 h-8">
            <span className="sr-only">Abrir menú</span>
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
            <Pencil className="mr-2 w-4 h-4" /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsDeleteOpen(true)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash className="mr-2 w-4 h-4" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* DIÁLOGO DE EDICIÓN */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Operación Recurrente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input name="name" defaultValue={service.serviceName} required />
            </div>
            <div className="space-y-2">
              <Label>Entidad</Label>
              <ClientCombobox
                clients={clients}
                name="clientId"
                defaultValue={service.clientId?.toString()}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select name="type" defaultValue={service.serviceType || "service"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Ingreso</SelectItem>
                  <SelectItem value="payment">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto Mensual (USD)</Label>
              <Input
                name="amount"
                type="number"
                step="0.01"
                defaultValue={service.monthlyFee}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERTA DE ELIMINACIÓN */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la operación recurrente{" "}
              {`"${service.serviceName}".`}
              <br />
              <br />
              <strong>Nota:</strong> Las transacciones históricas NO se
              borrarán, pero quedarán desvinculadas (sin etiqueta de servicio).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
