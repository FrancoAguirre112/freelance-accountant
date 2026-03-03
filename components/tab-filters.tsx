"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface SelectFilterField {
  key: string;
  label: string;
  type: "select";
  options: { value: string; label: string }[];
}

interface ComboboxFilterField {
  key: string;
  label: string;
  type: "combobox";
  options: { value: string; label: string }[];
}

interface SwitchFilterField {
  key: string;
  label: string;
  type: "switch";
}

export type FilterField =
  | SelectFilterField
  | ComboboxFilterField
  | SwitchFilterField;

export function useTabFilters() {
  const [values, setValues] = React.useState<Record<string, string>>({});

  const onChange = React.useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onClear = React.useCallback(() => setValues({}), []);

  return { values, onChange, onClear };
}

function ComboboxFilter({
  field,
  value,
  onChange,
}: {
  field: ComboboxFilterField;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = field.options.find((o) => o.value === value);

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{field.label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between w-full h-8 text-sm font-normal"
          >
            {value && value !== "all" ? selected?.label : "Todos"}
            <ChevronsUpDown className="opacity-50 ml-2 w-3 h-3 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <Command>
            <CommandInput placeholder={`Buscar ${field.label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="all"
                  onSelect={() => { onChange("all"); setOpen(false); }}
                >
                  <Check className={cn("mr-2 w-3 h-3", (!value || value === "all") ? "opacity-100" : "opacity-0")} />
                  Todos
                </CommandItem>
                {field.options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => { onChange(opt.value); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 w-3 h-3", value === opt.value ? "opacity-100" : "opacity-0")} />
                    {opt.label}
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

export function TabFilters({
  fields,
  values,
  onChange,
  onClear,
}: {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
}) {
  const activeCount = fields.filter((f) => {
    const val = values[f.key];
    if (!val) return false;
    if (f.type === "switch") return val === "true";
    return val !== "all";
  }).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative shrink-0 w-9 h-9"
        >
          <Filter className="w-4 h-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex items-center justify-between mb-4">
          <p className="font-medium text-sm">Filtros</p>
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground"
              onClick={onClear}
            >
              Limpiar
            </Button>
          )}
        </div>
        <div className="space-y-4">
          {fields.map((field) => {
            if (field.type === "switch") {
              return (
                <div
                  key={field.key}
                  className="flex items-center justify-between"
                >
                  <Label
                    htmlFor={`filter-${field.key}`}
                    className="font-normal text-sm"
                  >
                    {field.label}
                  </Label>
                  <Switch
                    id={`filter-${field.key}`}
                    checked={values[field.key] === "true"}
                    onCheckedChange={(checked) =>
                      onChange(field.key, checked ? "true" : "false")
                    }
                  />
                </div>
              );
            }

            if (field.type === "combobox") {
              return (
                <ComboboxFilter
                  key={field.key}
                  field={field}
                  value={values[field.key] || "all"}
                  onChange={(v) => onChange(field.key, v)}
                />
              );
            }

            return (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-sm">{field.label}</Label>
                <Select
                  value={values[field.key] || "all"}
                  onValueChange={(v) => onChange(field.key, v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {field.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
