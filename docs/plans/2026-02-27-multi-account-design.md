# Multi-Account with Google Auth Design

## Summary

Transform the single-user freelance dashboard into a multi-account application with Google sign-in, two profile types (Programador and Marketing), and per-user data isolation. Simplify the app by merging the Sueldo/RTN tab into a unified "Servicios Recurrentes" tab.

## Decisions

- **Auth library:** Auth.js v5 with Drizzle adapter and database sessions
- **Data isolation:** Shared database with userId column on all tables
- **Profile types:** Programador and Marketing — same features, separate data
- **Onboarding:** Profile type selected on first sign-in, stored in users table
- **Tab simplification:** Remove Sueldo tab, rename Mantenimientos to "Servicios Recurrentes"

## Authentication & User Model

Auth.js v5 with Google provider and Drizzle adapter adds 4 tables:

- **users** — Google profile data + `profileType` (`'programador' | 'marketing'`)
- **accounts** — OAuth account links
- **sessions** — Database-backed sessions
- **verification_tokens** — Required by adapter (unused initially)

### Auth Flow

1. User visits app → middleware checks session → redirect to `/login` if unauthenticated
2. User clicks "Sign in with Google" → Auth.js handles OAuth
3. First sign-in → redirect to `/onboarding` to pick profile type
4. Profile type stored in users table, all data scoped to user

### New Routes

- `/login` — Sign-in page with Google button
- `/onboarding` — Profile type selection (shown once)
- `/` — Dashboard (protected)

## Database Schema Changes

### New userId column on all existing tables

| Table | Change |
|-------|--------|
| clients | Add `userId` (required FK to users) |
| projects | Add `userId` (required FK to users) |
| transactions | Add `userId` (required FK to users) |
| recurringServices | Add `userId` (required FK to users) |

### Salary tab removal

- Remove SalaryTab component
- Keep both `maintenance` and `salary` types in recurringServices
- Display all in unified "Servicios Recurrentes" tab
- Remove salary-specific monthly coverage logic

### Query changes

- Every query gets `where` clause filtering by authenticated userId
- Every insert includes current userId

### Migration

- Existing data gets assigned to the first registered account or re-imported

## UI Changes

### Removed

- SalaryTab component and tab

### Renamed

- "Mantenimientos" → "Servicios Recurrentes" (covers maintenance + salary)

### New pages

- `/login` — Fiscus logo + "Sign in with Google" button
- `/onboarding` — Two cards for Programador / Marketing selection

### New UI elements

- User avatar/name in header with dropdown (profile badge, sign out)
- Profile type badge (informational only)

### Final tab structure (4 tabs)

1. Dashboard (overview charts)
2. Movimientos (transactions)
3. Proyectos (projects)
4. Servicios Recurrentes (recurring services)

## Security & Middleware

### Middleware (middleware.ts)

- Runs on every request
- Unauthenticated → redirect to `/login`
- Authenticated without profileType → redirect to `/onboarding`
- `/login` is public; `/onboarding` requires session but no profileType

### Server action protection

- Every server action calls `auth()` for session
- No session → throw error
- userId from session used in all queries/mutations

### Environment variables

- `AUTH_SECRET` — Auth.js secret
- `AUTH_GOOGLE_ID` — Google OAuth client ID
- `AUTH_GOOGLE_SECRET` — Google OAuth client secret
- Existing Turso variables unchanged
