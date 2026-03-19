import { TableCell } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

function SkeletonBar({ className = "w-20" }: { className?: string }) {
  return (
    <div
      className={`h-4 rounded bg-muted-foreground/15 animate-pulse ${className}`}
    />
  );
}

export function SkeletonCells({
  widths,
}: {
  widths: string[];
}) {
  return (
    <>
      {widths.map((w, i) => (
        <TableCell key={i}>
          <SkeletonBar className={w} />
        </TableCell>
      ))}
      <TableCell>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </TableCell>
    </>
  );
}
