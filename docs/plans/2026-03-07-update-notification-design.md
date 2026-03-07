# Update Notification Feature — Design

**Goal:** Show users a popup with changelog entries they haven't seen yet when they open the app.

**Architecture:** A static `changelog.json` file ships with the code. A client component checks localStorage for the last seen version, compares it to the latest entry, and shows a Dialog with unseen changes.

**Tech Stack:** Next.js, shadcn Dialog, localStorage

---

## Changelog format

`changelog.json` at project root (imported directly):

```json
[
  {
    "version": "0.2.0",
    "date": "2026-03-07",
    "changes": ["Cambio uno", "Cambio dos"]
  }
]
```

## Components

- `components/update-notification.tsx` — client component with Dialog
- Imported in `app/layout.tsx` alongside Toaster

## localStorage key

- `lastSeenVersion` — stores version string of latest dismissed changelog
