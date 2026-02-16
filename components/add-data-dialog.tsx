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
import { ClientCombobox } from "@/components/client-combobox";
import { ProjectCombobox } from "@/components/project-combobox";
import { RecurringServiceCombobox } from "@/components/recurring-service-combobox";
import {
  createTransactionAction,
  createProjectAction,
  createClientAction,
  createRecurringServiceAction,
} from "@/app/actions";
import { type InferSelectModel } from "drizzle-orm";
import { clients, projects, recurringServices } from "@/db/schema";

// Strict typing based on database schema
type Client = InferSelectModel<typeof clients>;
type Project = InferSelectModel<typeof projects>;
type RecurringService = InferSelectModel<typeof recurringServices>;
type TransactionCategory = "project" | "salary" | "maintenance" | "other";

export function AddDataDialog({
  clientsData,
  projectsData,
  servicesData,
}: {
  clientsData: Client[];
  projectsData: Project[];
  servicesData: RecurringService[];
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedCategory, setSelectedCategory] =
    React.useState<TransactionCategory>("project");

  // --- MANEJADORES DE SUBMIT (Modo Continuo) ---

  async function handleTransactionSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; // Guardamos referencia al form
    const formData = new FormData(form);

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
      serviceId: formData.get("serviceId")
        ? Number(formData.get("serviceId"))
        : null,
      status: "paid",
    });

    if (res.success) {
      toast.success("Transacción guardada", {
        description: "Puedes seguir agregando más.",
      });
      // Reseteamos los inputs de texto (Monto, Descripción, Fecha)
      // Nota: Los Comboboxes de React mantendrán su estado, lo cual es útil para cargas masivas del mismo proyecto.
      form.reset();
      // NO cerramos el modal: setOpen(false) eliminado.
    }
  }

  async function handleProjectSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const res = await createProjectAction({
      name: formData.get("name") as string,
      clientName: formData.get("clientName") as string,
      totalAmount: parseFloat(formData.get("totalAmount") as string),
      status: "en_desarrollo",
    });

    if (res.success) {
      toast.success("Proyecto creado exitosamente");
      form.reset();
    }
  }

  async function handleClientSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const res = await createClientAction({
      name: formData.get("name") as string,
      status: "active",
    });

    if (res.success) {
      toast.success("Cliente agregado");
      form.reset();
    }
  }

  async function handleRecurringSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const res = await createRecurringServiceAction({
      name: formData.get("name") as string,
      clientName: formData.get("clientName") as string,
      amount: parseFloat(formData.get("amount") as string),
      type: formData.get("type") as "maintenance" | "salary",
    });

    if (res.success) {
      toast.success("Servicio recurrente configurado");
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Agregar Dato
        </Button>
      </DialogTrigger>
      {/* Añadimos z-index alto para asegurar que el modal esté bien posicionado, 
          aunque los Toasts de Sonner suelen renderizarse en un Portal aparte con z-9999 */}
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

          {/* TAB: TRANSACTION */}
          <TabsContent value="transaction">
            <form onSubmit={handleTransactionSubmit} className="space-y-4 py-4">
              <div className="gap-4 grid grid-cols-2">
                <div className="space-y-2">
                  <Label>Fecha Real</Label>
                  {/* defaultValue={new Date().toISOString().split('T')[0]} ayuda a tener hoy por defecto */}
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
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  name="category"
                  required
                  onValueChange={(val: TransactionCategory) =>
                    setSelectedCategory(val)
                  }
                  defaultValue="project"
                >
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

              {/* Lógica Condicional de Selectores */}

              {selectedCategory === "project" && (
                <div className="space-y-2 slide-in-from-top-1 animate-in fade-in">
                  <Label>Vincular a Proyecto</Label>
                  <ProjectCombobox projects={projectsData} name="projectId" />
                </div>
              )}

              {(selectedCategory === "maintenance" ||
                selectedCategory === "salary") && (
                <div className="space-y-2 slide-in-from-top-1 animate-in fade-in">
                  <Label>Vincular a Servicio Recurrente</Label>
                  <RecurringServiceCombobox
                    services={servicesData}
                    name="serviceId"
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    Usa la <strong>Fecha Imputada</strong> arriba para indicar
                    qué mes estás cobrando.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input
                  name="description"
                  placeholder="Ej: Pago Hito 1"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  Guardar y Seguir
                </Button>
                {/* Botón opcional para cerrar manualmente si se desea */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cerrar
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* TAB: PROJECT */}
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
                <ClientCombobox
                  clients={clientsData}
                  name="clientName"
                  required
                />
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

          {/* TAB: CLIENT */}
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

          {/* TAB: RECURRING */}
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
                <ClientCombobox
                  clients={clientsData}
                  name="clientName"
                  required
                />
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
