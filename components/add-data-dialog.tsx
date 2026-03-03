"use client";

import * as React from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CSVImporter } from "@/components/csv-importer";
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
import { PagoCombobox } from "@/components/pago-combobox";
import { RecurringServiceCombobox } from "@/components/recurring-service-combobox";
import {
  createTransactionAction,
  createProjectAction,
  createPagoAction,
  createClientAction,
  createRecurringServiceAction,
} from "@/app/actions";
import { type InferSelectModel } from "drizzle-orm";
import { clients, projects, pagos, recurringServices } from "@/db/schema";
import { useActiveTab } from "@/components/active-tab-context";

type Client = InferSelectModel<typeof clients>;
type Project = InferSelectModel<typeof projects>;
type Pago = InferSelectModel<typeof pagos>;
type RecurringService = InferSelectModel<typeof recurringServices>;
type TransactionCategory = "project" | "recurring" | "pago" | "other";

export function AddDataDialog({
  clientsData,
  projectsData,
  pagosData,
  servicesData,
}: {
  clientsData: Client[];
  projectsData: Project[];
  pagosData: Pago[];
  servicesData: RecurringService[];
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedCategory, setSelectedCategory] =
    React.useState<TransactionCategory>("project");
  const [loading, setLoading] = React.useState(false);
  const { activeTab } = useActiveTab();

  const dialogTab = React.useMemo(() => {
    switch (activeTab) {
      case "transactions": return "transaction";
      case "projects": return "project";
      case "pagos": return "pago";
      case "maintenance": return "recurring";
      default: return "transaction";
    }
  }, [activeTab]);

  // --- MANEJADORES DE SUBMIT (Modo Continuo) ---

  async function handleTransactionSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await createTransactionAction({
        date: new Date(formData.get("date") as string + "T12:00:00Z"),
        imputedDate: formData.get("imputedDate")
          ? new Date(formData.get("imputedDate") as string + "T12:00:00Z")
          : new Date(formData.get("date") as string + "T12:00:00Z"),
        amount: parseFloat(formData.get("amount") as string),
        category: formData.get("category") as TransactionCategory,
        description: formData.get("description") as string,
        projectId: formData.get("projectId")
          ? Number(formData.get("projectId"))
          : null,
        pagoId: formData.get("pagoId")
          ? Number(formData.get("pagoId"))
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
        form.reset();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleProjectSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await createProjectAction({
        name: formData.get("name") as string,
        clientId: parseInt(formData.get("clientName") as string),
        totalAmount: parseFloat(formData.get("totalAmount") as string),
        status: "en_desarrollo",
      });

      if (res.success) {
        toast.success("Proyecto creado exitosamente");
        form.reset();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleClientSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await createClientAction({
        name: formData.get("name") as string,
        status: "active",
      });

      if (res.success) {
        toast.success("Entidad agregada");
        form.reset();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePagoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await createPagoAction({
        name: formData.get("name") as string,
        clientId: parseInt(formData.get("clientName") as string),
        totalAmount: parseFloat(formData.get("totalAmount") as string),
        status: "pendiente",
      });

      if (res.success) {
        toast.success("Pago creado exitosamente");
        form.reset();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRecurringSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await createRecurringServiceAction({
        name: formData.get("name") as string,
        clientName: formData.get("clientName") as string,
        amount: parseFloat(formData.get("amount") as string),
        type: formData.get("recurringType") as "service" | "payment",
      });

      if (res.success) {
        toast.success("Operación recurrente configurada");
        form.reset();
      }
    } finally {
      setLoading(false);
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
      <DialogContent className="sm:max-w-[650px]" showCloseButton={false}>
        <div className="grid grid-cols-3 items-center">
          <div className="justify-self-start">
            <CSVImporter />
          </div>
          <DialogTitle className="text-center">Carga de Datos</DialogTitle>
          <div className="justify-self-end">
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <X className="w-4 h-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        <Tabs key={open ? dialogTab : undefined} defaultValue={dialogTab} className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="transaction">Transacción</TabsTrigger>
            <TabsTrigger value="project">Proyecto</TabsTrigger>
            <TabsTrigger value="pago">Pago</TabsTrigger>
            <TabsTrigger value="client">Entidad</TabsTrigger>
            <TabsTrigger value="recurring">Recurrente</TabsTrigger>
          </TabsList>

          {/* TAB: TRANSACTION */}
          <TabsContent value="transaction">
            <form onSubmit={handleTransactionSubmit} className="space-y-4 py-4">
              <div className={`gap-4 grid ${selectedCategory === "recurring" ? "grid-cols-2" : "grid-cols-1"}`}>
                <div className="space-y-2">
                  <Label>Fecha Real</Label>
                  <Input name="date" type="date" required />
                </div>
                {selectedCategory === "recurring" && (
                  <div className="space-y-2">
                    <Label>Fecha Imputada</Label>
                    <Input
                      name="imputedDate"
                      type="date"
                      placeholder="Opcional"
                    />
                  </div>
                )}
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
                    <SelectItem value="recurring">
                      Recurrente (Violeta)
                    </SelectItem>
                    <SelectItem value="pago">Pago (Rojo)</SelectItem>
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

              {selectedCategory === "recurring" && (
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

              {selectedCategory === "pago" && (
                <div className="space-y-2 slide-in-from-top-1 animate-in fade-in">
                  <Label>Vincular a Pago</Label>
                  <PagoCombobox pagos={pagosData} name="pagoId" />
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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar y Seguir"}
              </Button>
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
                <Label>Entidad</Label>
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Proyecto"}
              </Button>
            </form>
          </TabsContent>

          {/* TAB: PAGO */}
          <TabsContent value="pago">
            <form onSubmit={handlePagoSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre del Pago</Label>
                <Input
                  name="name"
                  placeholder="Ej: Hosting Anual"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Entidad</Label>
                <ClientCombobox
                  clients={clientsData}
                  name="clientName"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Monto Total (USD)</Label>
                <Input name="totalAmount" type="number" step="0.01" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Pago"}
              </Button>
            </form>
          </TabsContent>

          {/* TAB: CLIENT */}
          <TabsContent value="client">
            <form onSubmit={handleClientSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre de la Entidad / Empresa</Label>
                <Input name="name" placeholder="Ej: Mermoz SAS" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Entidad"}
              </Button>
            </form>
          </TabsContent>

          {/* TAB: RECURRING */}
          <TabsContent value="recurring">
            <form onSubmit={handleRecurringSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre de la Operación</Label>
                <Input
                  name="name"
                  placeholder="Ej: Mantenimiento Mensual"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Entidad</Label>
                <ClientCombobox
                  clients={clientsData}
                  name="clientName"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select name="recurringType" defaultValue="service">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Ingreso (Cobro)</SelectItem>
                    <SelectItem value="payment">Egreso (Pago)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto Mensual (USD)</Label>
                <Input name="amount" type="number" step="0.01" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Configurar Recurrencia"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
