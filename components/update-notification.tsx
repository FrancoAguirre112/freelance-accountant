"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CircleAlert } from "lucide-react";
import changelog from "@/changelog.json";

const STORAGE_KEY = "lastSeenVersion";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

function ChangelogDialog({
  entries,
  open,
  onClose,
}: {
  entries: ChangelogEntry[];
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novedades</DialogTitle>
          <DialogDescription>
            Estos son los últimos cambios en la aplicación
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-4 overflow-y-auto">
          {entries.map((entry) => (
            <div key={entry.version}>
              <h4 className="text-sm font-medium">
                v{entry.version}{" "}
                <span className="text-muted-foreground font-normal">
                  — {entry.date}
                </span>
              </h4>
              <ul className="text-muted-foreground mt-1 list-disc pl-5 text-sm">
                {entry.changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UpdateNotification() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      const latestVersion = changelog[0]?.version;

      if (!latestVersion || lastSeen === latestVersion) return;

      if (!lastSeen) {
        localStorage.setItem(STORAGE_KEY, latestVersion);
        return;
      }

      setOpen(true);
    } catch {
      // localStorage unavailable
    }
  }, []);

  function handleClose() {
    try {
      localStorage.setItem(STORAGE_KEY, changelog[0].version);
    } catch {
      // localStorage unavailable
    }
    setOpen(false);
  }

  return (
    <ChangelogDialog entries={changelog} open={open} onClose={handleClose} />
  );
}

export function ChangelogButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setOpen(true)}
      >
        <CircleAlert className="h-4 w-4" />
        <span className="sr-only">Ver novedades</span>
      </Button>
      <ChangelogDialog entries={changelog} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
