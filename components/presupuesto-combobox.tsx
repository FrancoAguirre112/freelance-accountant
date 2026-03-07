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

interface Presupuesto {
  id: number;
  name: string;
  type: string;
}

interface PresupuestoComboboxProps {
  presupuestos: Presupuesto[];
  name?: string;
  required?: boolean;
  filterType?: "ingreso" | "egreso";
}

export function PresupuestoCombobox({
  presupuestos,
  name,
  required,
  filterType,
}: PresupuestoComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  const filtered = filterType
    ? presupuestos.filter((p) => p.type === filterType)
    : presupuestos;

  const selected = filtered.find((p) => p.id.toString() === value);

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
              selected?.name
            ) : (
              <span className="text-muted-foreground">Buscar presupuesto...</span>
            )}
            <ChevronsUpDown className="opacity-50 ml-2 w-4 h-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width]"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Buscar presupuesto..." />
            <CommandList>
              <CommandEmpty>No se encontró.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="none"
                  onSelect={() => {
                    setValue("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 w-4 h-4",
                      value === "" ? "opacity-100" : "opacity-0",
                    )}
                  />
                  Ninguno (Sin vincular)
                </CommandItem>
                {filtered.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.name}
                    onSelect={() => {
                      setValue(p.id.toString());
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 w-4 h-4",
                        value === p.id.toString() ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {p.name}
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
