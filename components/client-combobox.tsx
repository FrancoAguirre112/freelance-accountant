"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

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

interface Client {
  id: number;
  name: string;
}

interface ClientComboboxProps {
  clients: Client[];
  name?: string;
  required?: boolean;
  defaultValue?: string; // <--- 1. Agregamos esta propiedad opcional
}

export function ClientCombobox({
  clients,
  name,
  required,
  defaultValue,
}: ClientComboboxProps) {
  const [open, setOpen] = React.useState(false);

  // 2. Usamos defaultValue para inicializar el estado (si existe)
  const [value, setValue] = React.useState(defaultValue || "");

  const selectedClient = clients.find(
    (client) => client.id.toString() === value,
  );

  return (
    <div className="flex flex-col w-full">
      {/* Input oculto para que el FormData capture el valor */}
      <input type="hidden" name={name} value={value} required={required} />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between w-full font-normal"
          >
            {value ? (
              selectedClient?.name
            ) : (
              <span className="text-muted-foreground">
                Seleccionar cliente...
              </span>
            )}
            <ChevronsUpDown className="opacity-50 ml-2 w-4 h-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
          <Command>
            <CommandInput placeholder="Buscar cliente..." />
            <CommandList>
              <CommandEmpty>No se encontró el cliente.</CommandEmpty>
              <CommandGroup>
                {clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.name}
                    onSelect={() => {
                      // Guardamos el ID como valor
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
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
