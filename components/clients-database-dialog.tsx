"use client";

import { useState } from "react";
import { Users, MoreHorizontal, Filter, Pencil, Trash } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { updateClientAction, deleteClientAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { type InferSelectModel } from "drizzle-orm";
import { clients } from "@/db/schema";

// Define strict type based on the schema
type Client = InferSelectModel<typeof clients>;

export function ClientsDatabaseDialog({ clients }: { clients: Client[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterByClient = (clientId: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("clientId", clientId.toString());
    router.push(`/?${params.toString()}`);
    setOpen(false); // Close modal to see filtered dashboard
  };

  const handleEditName = async (client: Client) => {
    const newName = window.prompt("Ingresa el nuevo nombre:", client.name);
    if (!newName || newName === client.name) return;

    toast.promise(updateClientAction(client.id, { name: newName }), {
      loading: "Actualizando cliente...",
      success: "Nombre actualizado",
      error: "Error al actualizar",
    });
  };

  const handleArchive = async (client: Client) => {
    const isConfirmed = window.confirm(
      `¿Seguro que deseas archivar a ${client.name}? Ya no aparecerá en los selectores. Sus proyectos y pagos seguirán existiendo en la base de datos.`
    );
    if (!isConfirmed) return;

    toast.promise(updateClientAction(client.id, { status: "archived" }), {
      loading: "Archivando cliente...",
      success: "Cliente archivado. Se ocultará de la lista al refrescar.",
      error: "Error al archivar",
    });
  };

  const handlePermanentDelete = async (client: Client) => {
    const isConfirmed = window.confirm(
      `ATENCIÓN: ¿Deseas eliminar permanentemente a ${client.name} de la base de datos?\nEsta acción es ireversible. Solo se permite si no tiene proyectos ni pagos asociados.`
    );
    if (!isConfirmed) return;

    const res = await deleteClientAction(client.id);
    if (!res.success) {
      toast.error(res.error);
    } else {
      toast.success("Cliente eliminado permanentemente.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users className="w-4 h-4" /> Clientes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Base de Datos de Clientes</DialogTitle>
        </DialogHeader>

        <div className="border rounded-md max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-mono text-xs">
                    {client.id}
                  </TableCell>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        client.status === "active" ? "default" : "secondary"
                      }
                    >
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="p-0 w-8 h-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => handleFilterByClient(client.id)}
                        >
                          <Filter className="mr-2 w-4 h-4" /> Filtrar todo por
                          este cliente
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleEditName(client)}
                        >
                          <Pencil className="mr-2 w-4 h-4" /> Editar nombre
                        </DropdownMenuItem>

                        {client.status === "active" ? (
                          <DropdownMenuItem
                            className="text-orange-600"
                            onClick={() => handleArchive(client)}
                          >
                            <Trash className="mr-2 w-4 h-4" /> Archivar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="text-red-600 font-bold"
                            onClick={() => handlePermanentDelete(client)}
                          >
                            <Trash className="mr-2 w-4 h-4" /> Eliminar Permanente
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
