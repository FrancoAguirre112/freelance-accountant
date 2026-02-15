"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type InferSelectModel } from "drizzle-orm";
import { clients, projects } from "@/db/schema";

type Client = InferSelectModel<typeof clients>;
type Project = InferSelectModel<typeof projects>;

interface ActiveFiltersProps {
  clients: Client[];
  projects: Project[];
}

export function ActiveFilters({ clients, projects }: ActiveFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Función para traducir ID -> Nombre Legible
  const getLabel = (key: string, value: string) => {
    switch (key) {
      case "clientId":
        const client = clients.find((c) => c.id.toString() === value);
        return client ? `Cliente: ${client.name}` : `Cliente ID: ${value}`;

      case "projectId":
        const project = projects.find((p) => p.id.toString() === value);
        return project ? `Proyecto: ${project.name}` : `Proyecto ID: ${value}`;

      case "category":
        // Traducir valores técnicos a español visual
        const catMap: Record<string, string> = {
          project: "Proyecto",
          salary: "Sueldo",
          maintenance: "Mantenimiento",
          other: "Otro",
        };
        return `Categoría: ${catMap[value] || value}`;

      case "type":
        const typeMap: Record<string, string> = {
          maintenance: "Mantenimiento",
          salary: "Sueldo",
        };
        return `Tipo: ${typeMap[value] || value}`;

      default:
        return `${key}: ${value}`;
    }
  };

  const filterKeys = ["clientId", "projectId", "category", "type"];

  // Generamos la lista de filtros activos con sus etiquetas legibles
  const activeFilters = filterKeys
    .filter((key) => searchParams.has(key) && searchParams.get(key) !== "")
    .map((key) => ({
      key,
      value: searchParams.get(key)!,
      label: getLabel(key, searchParams.get(key)!),
    }));

  if (activeFilters.length === 0) return null;

  const removeFilter = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    filterKeys.forEach((key) => params.delete(key));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="font-medium text-muted-foreground text-sm">
        Filtros activos:
      </span>
      {activeFilters.map((filter) => (
        <Badge key={filter.key} variant="secondary" className="gap-1 pr-1">
          {filter.label}
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-transparent rounded-full w-4 h-4"
            onClick={() => removeFilter(filter.key)}
          >
            <X className="w-3 h-3" />
          </Button>
        </Badge>
      ))}
      <Button
        variant="link"
        size="sm"
        onClick={clearAll}
        className="p-0 h-auto text-muted-foreground"
      >
        Limpiar todo
      </Button>
    </div>
  );
}
