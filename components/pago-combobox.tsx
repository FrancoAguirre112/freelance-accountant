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

interface Pago {
  id: number;
  name: string;
}

interface PagoComboboxProps {
  pagos: Pago[];
  name?: string;
  required?: boolean;
}

export function PagoCombobox({
  pagos,
  name,
  required,
}: PagoComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  const selectedPago = pagos.find(
    (pago) => pago.id.toString() === value,
  );

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
              selectedPago?.name
            ) : (
              <span className="text-muted-foreground">Buscar pago...</span>
            )}
            <ChevronsUpDown className="opacity-50 ml-2 w-4 h-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width]"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Buscar pago..." />
            <CommandList>
              <CommandEmpty>No se encontró el pago.</CommandEmpty>
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

                {pagos.map((pago) => (
                  <CommandItem
                    key={pago.id}
                    value={pago.name}
                    onSelect={() => {
                      setValue(pago.id.toString());
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 w-4 h-4",
                        value === pago.id.toString()
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {pago.name}
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
