"use client";

import { useState, useMemo } from "react";
import {
  Users,
  MoreHorizontal,
  Pencil,
  Trash,
  Plus,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateClientAction,
  deleteClientAction,
  createClientAction,
} from "@/app/actions";
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
import { Input } from "@/components/ui/input";
import { type InferSelectModel } from "drizzle-orm";
import { clients } from "@/db/schema";
import type { ClientOutstanding } from "@/lib/balances";

type Client = InferSelectModel<typeof clients>;
type Kind = "customer" | "collaborator" | "vendor";
type SortKey = "name" | "status";
type SortDir = "asc" | "desc";

const KIND_LABEL: Record<Kind, string> = {
  customer: "Cliente",
  collaborator: "Colaborador",
  vendor: "Proveedor",
};
const KIND_VARIANT: Record<Kind, "default" | "secondary" | "outline"> = {
  customer: "default",
  collaborator: "secondary",
  vendor: "outline",
};
const formatUSD = (n: number) =>
  n.toLocaleString("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export function ClientsDatabaseDialog({
  clients,
  outstandingMap,
}: {
  clients: Client[];
  outstandingMap?: Record<number, ClientOutstanding>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column)
      return <ChevronsUpDown className="ml-1 w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 w-3 h-3" />
    ) : (
      <ChevronDown className="ml-1 w-3 h-3" />
    );
  };

  const filtered = useMemo(() => {
    const lower = search.toLowerCase().trim();
    let list = clients;

    if (lower) {
      list = list.filter((c) => c.name.toLowerCase().includes(lower));
    }

    return [...list].sort((a, b) => {
      const valA = (a[sortKey] || "").toLowerCase();
      const valB = (b[sortKey] || "").toLowerCase();
      const cmp = valA.localeCompare(valB);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [clients, search, sortKey, sortDir]);

  const hasExactMatch = clients.some(
    (c) => c.name.toLowerCase() === search.toLowerCase().trim(),
  );

  const handleCreate = async () => {
    const name = search.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await createClientAction({ name, status: "active" });
      if (res.success) {
        toast.success(`Entidad "${name}" creada`);
        setSearch("");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleChangeKind = (client: Client, kind: Kind) => {
    if (client.kind === kind) return;
    toast.promise(updateClientAction(client.id, { kind }), {
      loading: "Cambiando tipo...",
      success: `Tipo actualizado a ${KIND_LABEL[kind]}`,
      error: "Error al cambiar tipo",
    });
  };

  const handleEditName = async (client: Client) => {
    const newName = window.prompt("Ingresa el nuevo nombre:", client.name);
    if (!newName || newName === client.name) return;

    toast.promise(updateClientAction(client.id, { name: newName }), {
      loading: "Actualizando entidad...",
      success: "Nombre actualizado",
      error: "Error al actualizar",
    });
  };

  const handleArchive = async (client: Client) => {
    const isConfirmed = window.confirm(
      `¿Seguro que deseas archivar a ${client.name}? Ya no aparecerá en los selectores. Sus proyectos y pagos seguirán existiendo.`,
    );
    if (!isConfirmed) return;

    toast.promise(updateClientAction(client.id, { status: "archived" }), {
      loading: "Archivando entidad...",
      success: "Entidad archivada. Se ocultará de la lista al refrescar.",
      error: "Error al archivar",
    });
  };

  const handleRestore = async (client: Client) => {
    toast.promise(updateClientAction(client.id, { status: "active" }), {
      loading: "Restaurando entidad...",
      success: "Entidad restaurada",
      error: "Error al restaurar",
    });
  };

  const handlePermanentDelete = async (client: Client) => {
    const isConfirmed = window.confirm(
      `ATENCIÓN: ¿Deseas eliminar permanentemente a ${client.name}?\nEsta acción es irreversible. Solo se permite si no tiene proyectos ni pagos asociados.`,
    );
    if (!isConfirmed) return;

    const res = await deleteClientAction(client.id);
    if (!res.success) {
      toast.error(res.error);
    } else {
      toast.success("Entidad eliminada permanentemente.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users className="w-4 h-4" /> Entidades
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Entidades</DialogTitle>
        </DialogHeader>

        <div className="relative flex items-center">
          <Search className="top-1/2 left-3 absolute w-4 h-4 text-muted-foreground -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar o crear entidad..."
            className="pl-9"
          />
        </div>

        {search.trim() && !hasExactMatch && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-primary"
            onClick={handleCreate}
            disabled={creating}
          >
            <Plus className="w-4 h-4" />
            {creating ? "Creando..." : `Crear "${search.trim()}"`}
          </Button>
        )}

        <div className="border rounded-md max-h-[50vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => toggleSort("name")}
                  >
                    Nombre
                    <SortIcon column="name" />
                  </button>
                </TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => toggleSort("status")}
                  >
                    Estado
                    <SortIcon column="status" />
                  </button>
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {search
                      ? "No se encontraron entidades."
                      : "No hay entidades registradas."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((client) => {
                  const kind = (client.kind ?? "customer") as Kind;
                  const owed = outstandingMap?.[client.id];
                  return (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <div>{client.name}</div>
                      {owed && owed.outstanding > 0 && (
                        <div className="text-xs text-amber-600 dark:text-amber-400">
                          Adeudado: {formatUSD(owed.outstanding)} · pagado{" "}
                          {formatUSD(owed.totalPaid)} de{" "}
                          {formatUSD(owed.totalOwed)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={KIND_VARIANT[kind]}>
                        {KIND_LABEL[kind]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          client.status === "active" ? "default" : "secondary"
                        }
                      >
                        {client.status === "active" ? "Activo" : "Archivado"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="p-0 w-8 h-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => handleEditName(client)}
                          >
                            <Pencil className="mr-2 w-4 h-4" /> Editar nombre
                          </DropdownMenuItem>

                          {(["customer", "collaborator", "vendor"] as Kind[])
                            .filter((k) => k !== kind)
                            .map((k) => (
                              <DropdownMenuItem
                                key={k}
                                onClick={() => handleChangeKind(client, k)}
                              >
                                Marcar como {KIND_LABEL[k]}
                              </DropdownMenuItem>
                            ))}

                          {client.status === "active" ? (
                            <DropdownMenuItem
                              className="text-orange-600"
                              onClick={() => handleArchive(client)}
                            >
                              <Trash className="mr-2 w-4 h-4" /> Archivar
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleRestore(client)}
                              >
                                <Plus className="mr-2 w-4 h-4" /> Restaurar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600 font-bold"
                                onClick={() => handlePermanentDelete(client)}
                              >
                                <Trash className="mr-2 w-4 h-4" /> Eliminar
                                Permanente
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
