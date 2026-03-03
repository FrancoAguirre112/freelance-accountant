"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface SortConfig {
  key: string;
  dir: "asc" | "desc";
}

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  sort: SortConfig | null;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = sort?.key === sortKey;

  return (
    <TableHead className={cn("select-none", className)}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded-sm"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {isActive && sort.dir === "asc" ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : isActive && sort.dir === "desc" ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />
        )}
      </button>
    </TableHead>
  );
}

export function useSort() {
  const [sort, setSort] = React.useState<SortConfig | null>(null);

  function onSort(key: string) {
    setSort((prev) =>
      prev?.key === key
        ? prev.dir === "asc"
          ? { key, dir: "desc" }
          : null
        : { key, dir: "asc" },
    );
  }

  return { sort, onSort };
}
