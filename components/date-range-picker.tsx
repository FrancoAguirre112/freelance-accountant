"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfWeek,
  endOfWeek,
  subYears,
} from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// --- HELPER: Parseo Estricto a Hora Local ---
// Soluciona el bug de "un día menos" por conversión UTC
function parseLocalDate(dateStr: string | null) {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split("-").map(Number);
  // new Date(año, mesIndex, dia) crea la fecha en hora LOCAL, no UTC.
  // Recordar que el mes es base-0 (Enero = 0)
  return new Date(year, month - 1, day);
}

export function DateRangePicker({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estado para controlar la visibilidad del Popover
  const [isOpen, setIsOpen] = React.useState(false);

  // Inicializamos usando el helper para evitar el desfase horario
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: searchParams.get("from")
      ? parseLocalDate(searchParams.get("from"))
      : startOfMonth(new Date()),
    to: searchParams.get("to")
      ? parseLocalDate(searchParams.get("to"))
      : endOfMonth(new Date()),
  });

  // --- LÓGICA DE PERSISTENCIA (LOCALSTORAGE) ---

  // 1. Restaurar desde LocalStorage al cargar (si URL vacía)
  React.useEffect(() => {
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!fromParam && !toParam) {
      const savedFrom = localStorage.getItem("dashboard_from");
      const savedTo = localStorage.getItem("dashboard_to");

      if (savedFrom && savedTo) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("from", savedFrom);
        params.set("to", savedTo);
        router.replace(`/?${params.toString()}`);

        // Usamos parseLocalDate aquí también
        setDate({
          from: parseLocalDate(savedFrom),
          to: parseLocalDate(savedTo),
        });
      }
    }
  }, []);

  // 2. Guardar en LocalStorage al cambiar URL
  React.useEffect(() => {
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (fromParam && toParam) {
      localStorage.setItem("dashboard_from", fromParam);
      localStorage.setItem("dashboard_to", toParam);
    }

    // Opcional: Sincronizar estado interno si la URL cambia externamente (navegación atrás/adelante)
    if (fromParam && toParam) {
      setDate({
        from: parseLocalDate(fromParam),
        to: parseLocalDate(toParam),
      });
    }
  }, [searchParams]);

  // ----------------------------------------------------

  const handleApply = (selectedDate: DateRange | undefined) => {
    const targetDate = selectedDate || date;

    if (targetDate?.from && targetDate?.to) {
      const from = format(targetDate.from, "yyyy-MM-dd");
      const to = format(targetDate.to, "yyyy-MM-dd");

      const params = new URLSearchParams(searchParams.toString());
      params.set("from", from);
      params.set("to", to);

      router.push(`/?${params.toString()}`);
      setDate(targetDate);
      setIsOpen(false);
    }
  };

  const applyPreset = (preset: string) => {
    const today = new Date();
    let newRange: DateRange | undefined;

    switch (preset) {
      case "thisMonth":
        newRange = { from: startOfMonth(today), to: endOfMonth(today) };
        break;
      case "thisYear":
        newRange = { from: startOfYear(today), to: endOfYear(today) };
        break;
      case "lastYear":
        const lastYear = subYears(today, 1);
        newRange = { from: startOfYear(lastYear), to: endOfYear(lastYear) };
        break;
      case "thisWeek":
        newRange = {
          from: startOfWeek(today, { weekStartsOn: 1 }),
          to: endOfWeek(today, { weekStartsOn: 1 }),
        };
        break;
    }

    if (newRange) {
      setDate(newRange);
      handleApply(newRange);
    }
  };

  return (
    <div className={cn("gap-2 grid", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "justify-start w-[260px] font-normal text-left",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 w-4 h-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd MMM y", { locale: es })} -{" "}
                  {format(date.to, "dd MMM y", { locale: es })}
                </>
              ) : (
                format(date.from, "dd MMM y", { locale: es })
              )
            ) : (
              <span>Seleccionar fecha</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-auto" align="end">
          <div className="flex">
            {/* Barra lateral de atajos */}
            <div className="flex flex-col gap-2 p-3 border-r min-w-[140px]">
              <span className="mb-1 px-2 font-medium text-muted-foreground text-xs">
                Accesos rápidos
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start font-normal"
                onClick={() => applyPreset("thisWeek")}
              >
                Esta semana
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start font-normal"
                onClick={() => applyPreset("thisMonth")}
              >
                Este mes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start font-normal"
                onClick={() => applyPreset("thisYear")}
              >
                Este año
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start font-normal"
                onClick={() => applyPreset("lastYear")}
              >
                Año pasado
              </Button>
            </div>

            {/* Calendario */}
            <div className="p-0">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
                locale={es}
              />
              <div className="flex justify-end gap-2 p-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => handleApply(undefined)}>
                  Aplicar Rango
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
