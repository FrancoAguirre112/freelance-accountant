"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTransactionAction,
  createProjectAction,
  createClientAction,
  createRecurringServiceAction,
} from "@/app/actions";
import { type InferSelectModel } from "drizzle-orm";
import { clients, projects } from "@/db/schema";

// Tipado estricto basado en el esquema de base de datos
type Client = InferSelectModel<typeof clients>;
type Project = InferSelectModel<typeof projects>;
type TransactionCategory = "project" | "salary" | "maintenance" | "other";

export function AddDataDialog({
  clientsData,
  projectsData,
}: {
  clientsData: Client[];
  projectsData: Project[];
}) {
  const [open, setOpen] = React.useState(false);

  // --- MANEJADORES DE SUBMIT ---

  async function handleTransactionSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const res = await createTransactionAction({
      date: new Date(formData.get("date") as string),
      imputedDate: formData.get("imputedDate")
        ? new Date(formData.get("imputedDate") as string)
        : new Date(formData.get("date") as string),
      amount: parseFloat(formData.get("amount") as string),
      category: formData.get("category") as TransactionCategory,
      description: formData.get("description") as string,
      projectId: formData.get("projectId")
        ? Number(formData.get("projectId"))
        : null,
      status: "paid",
    });

    if (res.success) {
      toast.success("Transacción guardada correctamente");
      setOpen(false);
    }
  }

  async function handleProjectSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const res = await createProjectAction({
      name: formData.get("name") as string,
      clientId: Number(formData.get("clientId")),
      totalAmount: parseFloat(formData.get("totalAmount") as string),
      status: "en_desarrollo",
    });

    if (res.success) {
      toast.success("Proyecto creado exitosamente");
      setOpen(false);
    }
  }

  async function handleClientSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const res = await createClientAction({
      name: formData.get("name") as string,
      status: "active",
    });

    if (res.success) {
      toast.success("Cliente agregado a la base de datos");
      setOpen(false);
    }
  }

  async function handleRecurringSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const res = await createRecurringServiceAction({
      name: formData.get("name") as string,
      clientId: Number(formData.get("clientId")),
      amount: parseFloat(formData.get("amount") as string),
      type: formData.get("type") as "maintenance" | "salary",
    });

    if (res.success) {
      toast.success("Servicio recurrente configurado correctamente");
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Agregar Dato
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Carga Manual de Datos</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="transaction" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="transaction">Transac.</TabsTrigger>
            <TabsTrigger value="project">Proyect.</TabsTrigger>
            <TabsTrigger value="client">Cliente</TabsTrigger>
            <TabsTrigger value="recurring">Recurr.</TabsTrigger>
          </TabsList>

          {/* TAB: TRANSACCIÓN */}
          <TabsContent value="transaction">
            <form onSubmit={handleTransactionSubmit} className="space-y-4 py-4">
              <div className="gap-4 grid grid-cols-2">
                <div className="space-y-2">
                  <Label>Fecha Real</Label>
                  <Input name="date" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label>Fecha Imputada</Label>
                  <Input
                    name="imputedDate"
                    type="date"
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Monto (USD)</Label>
                <Input name="amount" type="number" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select name="category" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de ingreso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">Proyecto (Azul)</SelectItem>
                    <SelectItem value="maintenance">
                      Mantenimiento (Violeta)
                    </SelectItem>
                    <SelectItem value="salary">Sueldo / RTN (Verde)</SelectItem>
                    <SelectItem value="other">Otro (Gris)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vincular a Proyecto</Label>
                <Select name="projectId">
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsData.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                Guardar Transacción
              </Button>
            </form>
          </TabsContent>

          {/* TAB: PROYECTO */}
          <TabsContent value="project">
            <form onSubmit={handleProjectSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre del Proyecto</Label>
                <Input
                  name="name"
                  placeholder="Ej: Rediseño Ecommerce"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select name="clientId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsData.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Presupuesto Total (USD)</Label>
                <Input name="totalAmount" type="number" step="0.01" required />
              </div>
              <Button type="submit" className="w-full">
                Crear Proyecto
              </Button>
            </form>
          </TabsContent>

          {/* TAB: CLIENTE */}
          <TabsContent value="client">
            <form onSubmit={handleClientSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre del Cliente / Empresa</Label>
                <Input name="name" placeholder="Ej: Mermoz SAS" required />
              </div>
              <Button type="submit" className="w-full">
                Guardar Cliente
              </Button>
            </form>
          </TabsContent>

          {/* TAB: RECURRENTE */}
          <TabsContent value="recurring">
            <form onSubmit={handleRecurringSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Descripción del Abono</Label>
                <Input
                  name="name"
                  placeholder="Ej: Mantenimiento Mensual"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Recurrencia</Label>
                <Select name="type" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">
                      Mantenimiento (Violeta)
                    </SelectItem>
                    <SelectItem value="salary">Sueldo / RTN (Verde)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select name="clientId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Vincular cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsData.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto Mensual Objetivo (USD)</Label>
                <Input name="amount" type="number" step="0.01" required />
              </div>
              <Button type="submit" className="w-full">
                Configurar Recurrencia
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
