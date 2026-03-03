"use client";

import * as React from "react";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { Montserrat } from "next/font/google";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveTab } from "@/components/active-tab-context";
import { ThemeToggle } from "@/components/theme-toggle";

const montserrat = Montserrat({ subsets: ["latin"], weight: "900" });

const TAB_LABELS: Record<string, string> = {
  overview: "Dashboard",
  transactions: "Movimientos",
  projects: "Proyectos",
  pagos: "Pagos",
  maintenance: "Recurrentes",
};

export function MobileNav({
  userMenu,
  entidadesButton,
}: {
  userMenu: React.ReactNode;
  entidadesButton: React.ReactNode;
}) {
  const { activeTab, setActiveTab } = useActiveTab();
  const [sheetOpen, setSheetOpen] = React.useState(false);

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Hamburger */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0 w-9 h-9">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[280px] flex flex-col"
          showCloseButton={false}
        >
          <SheetHeader className="flex-row items-center justify-between">
            <SheetTitle className="flex items-center gap-3">
              <Image
                src="/Flogo.webp"
                alt="Logo"
                width={500}
                height={500}
                className="w-8 h-8"
              />
              <span className={`${montserrat.className} text-2xl`}>Fiscus</span>
            </SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <X className="w-4 h-4" />
              </Button>
            </SheetClose>
          </SheetHeader>

          <div className="flex flex-col gap-3 px-4">
            <div className="grid">{userMenu}</div>
            <div className="grid" onClick={() => setSheetOpen(false)}>
              {entidadesButton}
            </div>
          </div>

          <div className="mt-auto px-4 pb-4">
            <ThemeToggle />
          </div>
        </SheetContent>
      </Sheet>

      {/* Tab selector */}
      <Select value={activeTab} onValueChange={setActiveTab}>
        <SelectTrigger className="flex-1 font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(TAB_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
