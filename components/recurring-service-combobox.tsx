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

interface RecurringService {
  id: number;
  name: string;
}

interface RecurringServiceComboboxProps {
  services: RecurringService[];
  name?: string;
  required?: boolean;
}

export function RecurringServiceCombobox({
  services,
  name,
  required,
}: RecurringServiceComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  const selectedService = services.find((s) => s.id.toString() === value);

  return (
    <div className="flex flex-col w-full">
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
              selectedService?.name
            ) : (
              <span className="text-muted-foreground">
                Buscar servicio/abono...
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
            <CommandInput placeholder="Buscar servicio..." />
            <CommandList>
              <CommandEmpty>No se encontró el servicio.</CommandEmpty>
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

                {services.map((service) => (
                  <CommandItem
                    key={service.id}
                    value={service.name}
                    onSelect={() => {
                      setValue(service.id.toString());
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 w-4 h-4",
                        value === service.id.toString()
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {service.name}
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
