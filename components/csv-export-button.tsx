"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { serializeCsv } from "@/lib/csv";

interface CsvExportButtonProps {
  getData: () => Record<string, string | number>[];
  filename: string;
}

export function CsvExportButton({ getData, filename }: CsvExportButtonProps) {
  const handleExport = () => {
    const rows = getData();
    if (rows.length === 0) return;

    const csvContent = serializeCsv(rows);

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      className="shrink-0 w-9 h-9"
      onClick={handleExport}
      title="Exportar CSV"
    >
      <Download className="w-4 h-4" />
    </Button>
  );
}
