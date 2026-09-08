# Customer Command Center — Contract Transparency Portal

A customer-facing portal that gives government stakeholders visibility into contract execution across
all call orders under the AOUSC BPA for TSO Support Services (47QTCA20D00C6), and gives Project
Managers the place where they keep that information current.

Planning documents live under `.planning/`; the TechSur brand guide is under `project_specs/ref_docs/`.

## Stack

| Layer | Choice |
| --- | --- |
| Client | React 19 + TypeScript, built with Vite (`src/`) |
| API | Express 5 on Node 22 (`server/`) |
| Database | PostgreSQL 16 (`server/schema.sql`) |
| Shared types | `shared/types.ts` (imported by both sides) |

## Running locally

**Docker (Recommended):**

```bash
docker compose up
```

This starts:
- PostgreSQL database on port 5432
- API server on port 3000
- Vite dev server on port 5173

The containers automatically:
- Install dependencies
- Apply database schema migrations
- Start dev servers with hot reload

Access the portal at http://localhost:5173

**Local npm (Advanced):**

```bash
cp .env.example .env            # Configure DATABASE_URL and other settings
docker compose up -d db         # Start only the database
npm install
npm run db:migrate              # Apply schema
npm run db:seed                 # Load initial data
npm run dev                     # Start both servers
```

**Production:** `npm run build` then `npm start` serves the API and the built client from one process.

## What the portal does

- **Call Orders** — one row per call order with option periods rolled up onto the period that is
  current today; people, funded, actual spend with burn bar (below 75% accent, 75–85% amber, 86%+ red),
  last-updated stamp. Every column sorts both ways. Clicking the People number opens the People tab.
- **Call order detail** — Financials (funding summary to the cent, contracted labor categories),
  People (tiles, roster, by-labor-category drill-down with over-FTE flag), Weekly Status Reports
  (authored in the portal or uploaded, per call order).
- **Weekly Status Reports** — Project Managers create reports for their assigned call orders with 
  Sunday week selectors, draft/submit workflow, and auto-save. Program Managers view consolidated
  reports across all call orders, identify missing reports, and submit to customers. Customers view
  submitted reports read-only with week navigation.
- **Monthly Status Reports** — the BPA-level deliverable log with a section reader per call order.
  PMs can start a blank report, draft one from portal data (funding from the portal, activity from the
  weekly reports authored in that period), upload a file, and add or edit any call order's section.
- **Roles** — Four roles with distinct permissions: Customer (read-only on assigned call orders),
  Project Manager (edit assigned call orders, create weekly reports), Program Manager (full access,
  manage all reports), Administrator (user management).
- **Data currency** — financial and staffing records carry last-updated stamps; any save re-stamps
  them. Records older than `STALE_DAYS_FINANCIALS` / `STALE_DAYS_STAFFING` are flagged.
- **Audit history** — every change is written to `audit_log` with actor, role, action and details
  (`GET /api/audit`, PM only).

## Authentication

The portal uses JWT-based authentication with access and refresh tokens. Users log in with email and
password, receiving tokens stored in localStorage. All API requests include the access token in the
`Authorization: Bearer <token>` header. Optional Microsoft Entra ID (Azure AD) SSO can be configured
via environment variables (see `.env.example`).

## Data

`server/seed-data.ts` holds the source data verbatim (AO EAC Table, Call Order Staffing, June 2026
MSR, weekly touchpoint of 9/8/26). `npm run db:seed` reloads it, preserving the audit log. Uploaded
documents are stored under `uploads/` and served at `/uploads/…`.

## API

| Method | Path | Role |
| --- | --- | --- |
| **Authentication** | | |
| POST | `/api/auth/login` | public — `{ email, password }` returns tokens |
| POST | `/api/auth/register` | public — create new user account |
| POST | `/api/auth/refresh` | any — refresh access token |
| **Portal Data** | | |
| GET | `/api/portal` | any — full snapshot |
| GET | `/api/data` | any — filtered snapshot (role-based) |
| **Call Orders** | | |
| POST | `/api/call-orders/upload` | PM — multipart `files` |
| PATCH | `/api/call-orders/:id/spend` | PM — `{ spend }` |
| POST | `/api/call-orders/:id/staff` | PM — `{ name, laborCategory, rate }` |
| PATCH / DELETE | `/api/staff/:id` | PM — `{ status }` |
| **Weekly Reports** | | |
| GET | `/api/weekly-reports/weeks` | any — available week dates (Sundays) |
| POST | `/api/call-orders/:id/weekly-reports` | PM — create report |
| PUT | `/api/call-orders/:id/weekly-reports/:reportId` | PM/Program Manager — edit report |
| GET | `/api/call-orders/:id/weekly-reports/:reportId` | PM — get single report detail |
| POST | `/api/call-orders/:id/weekly-reports/upload` | PM — multipart `files` |
| GET | `/api/weekly-reports/consolidated/:weekEnding` | Program Manager — all reports for week |
| POST | `/api/weekly-reports/consolidated/:weekEnding/submit` | Program Manager — submit to customers |
| GET | `/api/weekly-reports/customer` | Customer — view submitted reports |
| **Monthly Reports** | | |
| POST | `/api/monthly-reports` | PM — `{ period, mode: "blank" \| "draft" }` |
| POST | `/api/monthly-reports/upload` | PM — multipart `files`, `period` |
| PUT | `/api/monthly-reports/:id/sections/:callOrderId` | PM — section content |
| **Admin & Audit** | | |
| GET | `/api/audit` | PM — change history |
| GET | `/api/admin/users` | Admin — list all users |
| POST | `/api/admin/users` | Admin — create user |
| PUT | `/api/admin/users/:id` | Admin — update user |
| DELETE | `/api/admin/users/:id` | Admin — delete user |

Most mutations respond with the refreshed snapshot.

## Troubleshooting

**Changes not appearing in browser:**

If you've modified code but don't see changes:

1. Check Docker logs for errors: `docker logs customer-command-center-api-1`
2. Restart containers: `docker restart customer-command-center-api-1 customer-command-center-web-1`
3. Force rebuild if needed: `docker compose up --build`

**Database issues:**

Reset database and reload seed data:
```bash
docker compose down -v  # Remove volumes
docker compose up       # Recreate and reseed
```

**Port conflicts:**

If ports 3000, 5173, or 5432 are already in use, modify `docker-compose.yml` or stop conflicting services.

**TypeScript errors:**

Check for syntax errors: `npm run type-check`

**Authentication issues:**

- Clear browser localStorage and cookies
- Check JWT_SECRET is set in `.env`
- Verify user exists in database: `docker exec -it customer-command-center-db-1 psql -U postgres -d contract_portal -c "SELECT * FROM users;"`
