"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ToolbarOverflow({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Desktop: show children inline */}
      <div className="hidden sm:contents">{children}</div>

      {/* Mobile: collapse into overflow menu */}
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="w-9 h-9">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="flex flex-col gap-1 p-2">
            {children}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
