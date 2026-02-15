"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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

interface ClientComboboxProps {
  clients: { id: number; name: string }[];
  name?: string; // Para que funcione dentro del form
  required?: boolean;
}

export function ClientCombobox({
  clients,
  name,
  required,
}: ClientComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [inputValue, setInputValue] = React.useState("");

  // Lógica inteligente: Si el usuario escribe, buscamos si existe ignorando mayúsculas
  const selectedClient = clients.find(
    (client) => client.name.toLowerCase() === value.toLowerCase(),
  );

  return (
    <div className="flex flex-col w-full">
      {/* Input oculto para que el FormData del padre capture el valor */}
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
              // Si tenemos valor, mostramos el nombre (priorizando el formato de la DB)
              selectedClient ? (
                selectedClient.name
              ) : (
                value
              )
            ) : (
              <span className="text-muted-foreground">
                Seleccionar o escribir cliente...
              </span>
            )}
            <ChevronsUpDown className="opacity-50 ml-2 w-4 h-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width]"
          align="start"
        >
          <Command>
            <CommandInput
              placeholder="Buscar cliente..."
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty className="px-4 py-2 text-sm">
                {/* Si no hay resultados, mostramos la opción de crear lo que el usuario escribió */}
                {inputValue && (
                  <div
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => {
                      setValue(inputValue); // Establecemos lo que el usuario escribió
                      setOpen(false);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    {`Crear ${inputValue}`}
                  </div>
                )}
              </CommandEmpty>

              <CommandGroup>
                {clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.name} // Importante: usamos el nombre como valor de búsqueda
                    onSelect={(currentValue) => {
                      // Al seleccionar, usamos el nombre REAL que viene de la base de datos (client.name)
                      // Esto arregla el problema de "mermoz" vs "Mermoz"
                      setValue(client.name);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 w-4 h-4",
                        value.toLowerCase() === client.name.toLowerCase()
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

      {/* Mensaje de ayuda dinámico */}
      <p className="mt-1 text-[0.8rem] text-muted-foreground">
        {!selectedClient && value.length > 0
          ? "Se creará un cliente nuevo automáticamente."
          : "Selecciona un cliente existente o escribe uno nuevo."}
      </p>
    </div>
  );
}
