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

```bash
cp .env.example .env            # DATABASE_URL, PORT, stale-record thresholds
docker compose up -d db         # or point DATABASE_URL at any PostgreSQL 16
npm install
npm run db:seed                 # applies the schema and loads the source-of-record data
npm run dev                     # API on :3001, Vite on :5173 (proxies /api and /uploads)
```

Production: `npm run build` then `npm start` serves the API and the built client from one process.

## What the portal does

- **Call Orders** — one row per call order with option periods rolled up onto the period that is
  current today; people, funded, actual spend with burn bar (below 75% accent, 75–85% amber, 86%+ red),
  last-updated stamp. Every column sorts both ways. Clicking the People number opens the People tab.
- **Call order detail** — Financials (funding summary to the cent, contracted labor categories),
  People (tiles, roster, by-labor-category drill-down with over-FTE flag), Weekly Status Reports
  (authored in the portal or uploaded, per call order).
- **Monthly Status Reports** — the BPA-level deliverable log with a section reader per call order.
  PMs can start a blank report, draft one from portal data (funding from the portal, activity from the
  weekly reports authored in that period), upload a file, and add or edit any call order's section.
- **Roles** — the header switch chooses Customer or Project Manager. Customers see no authoring
  affordance anywhere, and the API rejects every mutation that does not carry the PM role.
- **Data currency** — financial and staffing records carry last-updated stamps; any save re-stamps
  them. Records older than `STALE_DAYS_FINANCIALS` / `STALE_DAYS_STAFFING` are flagged.
- **Audit history** — every change is written to `audit_log` with actor, role, action and details
  (`GET /api/audit`, PM only).

## Identity

The client sends `x-portal-role` and `x-portal-user` headers based on the "View as" switch. This is a
stand-in: in production these headers must be set by the identity-aware proxy / SSO layer in front of
the API, so the browser never decides who is a Project Manager.

## Data

`server/seed-data.ts` holds the source data verbatim (AO EAC Table, Call Order Staffing, June 2026
MSR, weekly touchpoint of 9/8/26). `npm run db:seed` reloads it, preserving the audit log. Uploaded
documents are stored under `uploads/` and served at `/uploads/…`.

## API

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/portal` | any — full snapshot |
| POST | `/api/call-orders/upload` | PM — multipart `files` |
| PATCH | `/api/call-orders/:id/spend` | PM — `{ spend }` |
| POST | `/api/call-orders/:id/staff` | PM — `{ name, laborCategory, rate }` |
| PATCH / DELETE | `/api/staff/:id` | PM — `{ status }` |
| POST | `/api/call-orders/:id/weekly-reports` | PM — authored report |
| POST | `/api/call-orders/:id/weekly-reports/upload` | PM — multipart `files` |
| POST | `/api/monthly-reports` | PM — `{ period, mode: "blank" \| "draft" }` |
| POST | `/api/monthly-reports/upload` | PM — multipart `files`, `period` |
| PUT | `/api/monthly-reports/:id/sections/:callOrderId` | PM — section content |
| GET | `/api/audit` | PM — change history |

Every mutation responds with the refreshed snapshot.
