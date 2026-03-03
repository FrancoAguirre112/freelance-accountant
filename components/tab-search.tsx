"use client";

import * as React from "react";
import { Search, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SearchPrefix {
  key: string;
  label: string;
}

interface TabSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  prefixes: SearchPrefix[];
  defaultLabel?: string;
}

export function parseSearch(
  query: string,
  prefixes: SearchPrefix[],
): { field: string; term: string } {
  const trimmed = query.trim();
  for (const p of prefixes) {
    const prefix = `${p.key}:`;
    if (trimmed.toLowerCase().startsWith(prefix)) {
      return { field: p.key, term: trimmed.slice(prefix.length).trim() };
    }
  }
  return { field: "default", term: trimmed };
}

export function TabSearch({
  value,
  onChange,
  placeholder = "Buscar...",
  prefixes,
  defaultLabel = "nombre",
}: TabSearchProps) {
  return (
    <div className="w-full">
      <div className="relative flex items-center">
        <Search className="top-1/2 left-3 absolute w-4 h-4 text-muted-foreground -translate-y-1/2" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {prefixes.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="top-1/2 right-1 absolute w-7 h-7 -translate-y-1/2"
              >
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 text-sm">
              <p className="mb-2 font-medium">Prefijos de búsqueda</p>
              <p className="mb-3 text-muted-foreground text-xs">
                Escribe un prefijo seguido de tu búsqueda para filtrar por campo
                específico.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-muted px-1.5 py-0.5 rounded font-mono">
                    texto
                  </span>
                  <span className="text-muted-foreground">
                    Busca por {defaultLabel}
                  </span>
                </div>
                {prefixes.map((p) => (
                  <div key={p.key} className="flex items-center gap-2 text-xs">
                    <span className="bg-muted px-1.5 py-0.5 rounded font-mono">
                      {p.key}:texto
                    </span>
                    <span className="text-muted-foreground">
                      Busca por {p.label.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
