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
import { PresupuestoCombobox } from "@/components/presupuesto-combobox";
import { RecurringServiceCombobox } from "@/components/recurring-service-combobox";
import {
  createTransactionAction,
  createPresupuestoAction,
  createClientAction,
  createRecurringServiceAction,
} from "@/app/actions";
import { type InferSelectModel } from "drizzle-orm";
import { clients, presupuestos, recurringServices } from "@/db/schema";
import { useActiveTab } from "@/components/active-tab-context";

type Client = InferSelectModel<typeof clients>;
type Presupuesto = InferSelectModel<typeof presupuestos>;
type RecurringService = InferSelectModel<typeof recurringServices>;
type TransactionCategory = "presupuesto" | "recurring" | "other";

export function AddDataDialog({
  clientsData,
  presupuestosData,
  servicesData,
  fabMode = false,
}: {
  clientsData: Client[];
  presupuestosData: Presupuesto[];
  servicesData: RecurringService[];
  fabMode?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedCategory, setSelectedCategory] =
    React.useState<TransactionCategory>("presupuesto");
  const [loading, setLoading] = React.useState(false);
  const { activeTab } = useActiveTab();

  const dialogTab = React.useMemo(() => {
    switch (activeTab) {
      case "transactions": return "transaction";
      case "presupuestos": return "presupuesto";
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
        presupuestoId: formData.get("presupuestoId")
          ? Number(formData.get("presupuestoId"))
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

  async function handlePresupuestoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await createPresupuestoAction({
        name: formData.get("name") as string,
        clientId: parseInt(formData.get("clientName") as string),
        totalAmount: parseFloat(formData.get("totalAmount") as string),
        type: formData.get("presupuestoType") as "ingreso" | "egreso",
      });

      if (res.success) {
        toast.success("Presupuesto creado exitosamente");
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
        billingDay: parseInt(formData.get("billingDay") as string) || 1,
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
        {fabMode ? (
          <Button
            size="icon"
            className="h-14 w-14 rounded-full bg-[#48199D] hover:bg-[#48199D]/90 shadow-lg"
          >
            <Plus className="w-6 h-6 text-white" />
          </Button>
        ) : (
          <Button className="gap-2">
            <Plus className="w-4 h-4" /> Agregar Dato
          </Button>
        )}
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
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="transaction">Transacción</TabsTrigger>
            <TabsTrigger value="presupuesto">Presupuesto</TabsTrigger>
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
                  defaultValue="presupuesto"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de ingreso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presupuesto">Presupuesto (Azul)</SelectItem>
                    <SelectItem value="recurring">
                      Recurrente (Violeta)
                    </SelectItem>
                    <SelectItem value="other">Otro (Gris)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Lógica Condicional de Selectores */}

              {selectedCategory === "presupuesto" && (
                <div className="space-y-2 slide-in-from-top-1 animate-in fade-in">
                  <Label>Vincular a Presupuesto</Label>
                  <PresupuestoCombobox presupuestos={presupuestosData} name="presupuestoId" />
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

          {/* TAB: PRESUPUESTO */}
          <TabsContent value="presupuesto">
            <form onSubmit={handlePresupuestoSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre del Presupuesto</Label>
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
                <Label>Tipo</Label>
                <Select name="presupuestoType" defaultValue="ingreso">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Monto Total (USD)</Label>
                <Input name="totalAmount" type="number" step="0.01" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Presupuesto"}
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
              <div className="space-y-2">
                <Label>Día de cobro/pago</Label>
                <Input name="billingDay" type="number" min="1" max="31" defaultValue="1" required />
                <p className="text-xs text-muted-foreground">Día del mes en que se cobra o paga (1-31)</p>
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
