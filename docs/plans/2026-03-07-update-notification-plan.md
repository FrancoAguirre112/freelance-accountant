# Update Notification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a popup with unseen changelog entries when users open the app.

**Architecture:** Static JSON file with changelog entries, client component using shadcn Dialog, localStorage to track last seen version.

**Tech Stack:** Next.js, React, shadcn Dialog, localStorage

---

### Task 1: Create changelog.json

**Files:**
- Create: `changelog.json`

**Step 1: Create the changelog file**

```json
[
  {
    "version": "0.2.0",
    "date": "2026-03-07",
    "changes": [
      "Se añadió la funcionalidad de notificación de actualizaciones"
    ]
  }
]
```

**Step 2: Commit**

```bash
git add changelog.json
git commit -m "feat: add changelog.json for update notifications"
```

---

### Task 2: Create UpdateNotification component

**Files:**
- Create: `components/update-notification.tsx`

**Step 1: Create the component**

```tsx
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
import changelog from "@/changelog.json";

const STORAGE_KEY = "lastSeenVersion";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export function UpdateNotification() {
  const [unseenEntries, setUnseenEntries] = useState<ChangelogEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    const latestVersion = changelog[0]?.version;

    if (!latestVersion || lastSeen === latestVersion) return;

    if (!lastSeen) {
      // First visit — show all entries
      setUnseenEntries(changelog);
    } else {
      // Show entries newer than lastSeen
      const unseen = changelog.filter((entry: ChangelogEntry) => entry.version > lastSeen);
      setUnseenEntries(unseen);
    }

    setOpen(true);
  }, []);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, changelog[0].version);
    setOpen(false);
  }

  if (unseenEntries.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novedades</DialogTitle>
          <DialogDescription>
            Estos son los últimos cambios en la aplicación
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-4 overflow-y-auto">
          {unseenEntries.map((entry) => (
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
          <Button onClick={handleDismiss}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add components/update-notification.tsx
git commit -m "feat: add UpdateNotification component"
```

---

### Task 3: Add UpdateNotification to layout

**Files:**
- Modify: `app/layout.tsx:28-29`

**Step 1: Import and render the component**

Add import at top:
```tsx
import { UpdateNotification } from "@/components/update-notification";
```

Add `<UpdateNotification />` after `<Toaster />` inside the ThemeProvider:
```tsx
<Toaster position="top-center" richColors />
<UpdateNotification />
```

**Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: render UpdateNotification in root layout"
```

---

### Task 4: Add resolveJsonModule to tsconfig if needed

**Files:**
- Modify: `tsconfig.json` (only if `resolveJsonModule` is not already enabled)

**Step 1: Check tsconfig.json**

Verify `resolveJsonModule: true` is present. Next.js typically includes this by default. If missing, add it under `compilerOptions`.

**Step 2: Verify the build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 3: Commit (if changes were made)**

```bash
git add tsconfig.json
git commit -m "chore: enable resolveJsonModule in tsconfig"
```
