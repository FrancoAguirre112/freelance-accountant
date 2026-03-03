"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClientAction } from "@/app/actions";

interface Client {
  id: number;
  name: string;
}

interface ClientComboboxProps {
  clients: Client[];
  name?: string;
  required?: boolean;
  defaultValue?: string;
}

export function ClientCombobox({
  clients,
  name,
  required,
  defaultValue,
}: ClientComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(defaultValue || "");
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [createdName, setCreatedName] = React.useState<string | null>(null);

  const selectedClient = clients.find(
    (client) => client.id.toString() === value,
  );
  const displayName = selectedClient?.name ?? createdName;

  const hasExactMatch = clients.some(
    (c) => c.name.toLowerCase() === search.toLowerCase(),
  );

  const handleCreate = async () => {
    if (!search.trim() || creating) return;
    const trimmedName = search.trim();
    setCreating(true);
    try {
      const res = await createClientAction({
        name: trimmedName,
        status: "active",
      });
      if (res.success) {
        setValue(res.id.toString());
        setCreatedName(trimmedName);
        toast.success(`Entidad "${trimmedName}" creada`);
        setOpen(false);
        setSearch("");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col w-full">
      <input type="hidden" name={name} value={value} required={required} />

      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between w-full font-normal"
          >
            {value ? (
              displayName
            ) : (
              <span className="text-muted-foreground">
                Seleccionar entidad...
              </span>
            )}
            <ChevronsUpDown className="opacity-50 ml-2 w-4 h-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
          <Command>
            <CommandInput
              placeholder="Buscar entidad..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                <span className="text-muted-foreground">No se encontró la entidad.</span>
              </CommandEmpty>
              <CommandGroup>
                {clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.name}
                    onSelect={() => {
                      setValue(client.id.toString());
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 w-4 h-4",
                        value === client.id.toString()
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {client.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              {search.trim() && !hasExactMatch && (
                <CommandGroup>
                  <CommandItem
                    value={`__create__${search}`}
                    onSelect={handleCreate}
                    className="text-primary"
                  >
                    <Plus className="mr-2 w-4 h-4" />
                    {creating ? "Creando..." : `Crear "${search.trim()}"`}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
