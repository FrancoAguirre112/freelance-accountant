"use client";

import { useState } from "react";
import { Users, MoreHorizontal, Filter, Pencil, Trash } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
                          onClick={() => console.log("Editar", client.id)}
                        >
                          <Pencil className="mr-2 w-4 h-4" /> Editar nombre
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash className="mr-2 w-4 h-4" /> Eliminar (Archivar)
                        </DropdownMenuItem>
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
