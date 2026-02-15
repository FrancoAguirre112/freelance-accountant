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

interface Item {
  id: number;
  name: string;
}

interface SearchableFilterSelectProps {
  items: Item[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  label: string;
}

export function SearchableFilterSelect({
  items,
  value,
  onValueChange,
  placeholder,
  label,
}: SearchableFilterSelectProps) {
  const [open, setOpen] = React.useState(false);

  // Encontrar el nombre del ítem seleccionado para mostrarlo en el botón
  const selectedItem = items.find((item) => item.id.toString() === value);

  return (
    <div className="space-y-2">
      <span className="peer-disabled:opacity-70 font-medium text-sm leading-none peer-disabled:cursor-not-allowed">
        {label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between w-full font-normal"
          >
            {value === "all"
              ? `Todos los ${label.toLowerCase()}s`
              : selectedItem?.name || placeholder}
            <ChevronsUpDown className="opacity-50 ml-2 w-4 h-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width]"
          align="start"
        >
          <Command>
            <CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No se encontraron resultados.</CommandEmpty>
              <CommandGroup>
                {/* Opción "Todos" */}
                <CommandItem
                  value="all"
                  onSelect={() => {
                    onValueChange("all");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 w-4 h-4",
                      value === "all" ? "opacity-100" : "opacity-0",
                    )}
                  />
                  Todos los {label.toLowerCase()}s
                </CommandItem>

                {/* Lista de Items */}
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.name} // Buscamos por nombre
                    onSelect={() => {
                      onValueChange(item.id.toString()); // Guardamos el ID
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 w-4 h-4",
                        value === item.id.toString()
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {item.name}
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
