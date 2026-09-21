# TechSur Mission Control — Decision Log

Answers to the Mandatory Decision Gate (§26 of `TechSur_Mission_Control_LLM_Build_Instructions.md`). Recorded 2026-09-13.

| # | Question | Decision |
|---|---|---|
| 1 | Invoice aging start date | **Invoice Date** (spec default confirmed). Modeled after `August Invoice.pdf`: Invoice Number, Invoice Date, Customer Contract Nbr, Contract Desc, Terms (Net 30), Billing Thru, Purchase Order, CLIN/Task Order Value, CLIN/Task Order Funding, Total Funds Expended, % of Funds Expended, Remit To / Bill To, per-labor-category current & cumulative hours/rate/amount. |
| 2 | Magic-link lifetime | **10 minutes** (overrides spec's 15-minute provisional default; must remain configurable). |
| 3 | Risk probability/impact/severity matrix | **Standard 3×3 IT-program matrix** (Low/Medium/High × Low/Medium/High), config-driven per §14 — not hardcoded. Seed values: Low×Low=Low, Low×Med=Low, Low×High=Med, Med×Low=Low, Med×Med=Med, Med×High=High, High×Low=Med, High×Med=High, High×High=High. This is the confirmed value set (not provisional), but must still live in a configuration table, not code, so it can be edited without a deploy. |
| 4 | Approved-user (magic-link allowlist) management | **Paul, Aidan, and Jessica** can all manage the approved-email list (not Paul-only). |
| 5 | "Rate" shown to CORs | **Contract billing rate only** — confirmed, never employee compensation. |
| 6 | Source of truth for monthly actual spend & invoice payment status | **Manual entry** (current model retained; no file import/integration in Phase I). |
| 7 | File storage | **SharePoint** (external-URL file references), not Mission Control local disk/`uploads/`. |
| 8 | COR call-order scope | **Joan and Dean-Anne can see all call orders** (BPA-wide access, consistent with prior session's assignment) — not restricted per-COR. |
| 9 | Retention periods (audit logs, auth logs, personnel records, contract files, weekly reports) | **Indefinite** for all — no automatic purge/cleanup. |
| 10 | Lock/correct authority for weekly reports | **Paul and his designate(s)** — not Paul alone. Requires a configurable "can lock/correct" flag or role addition (e.g. a designated backup), distinct from the general `pm` role held by Aidan/Jessica. |

## Implications for implementation (not yet built)

- **Storage**: Phase I file references become SharePoint URLs (spec's `contract_file`/deliverable file-reference model already supports `file` or `url` type — decision #7 means Mission Control should treat SharePoint URL as the primary path, keep local upload as a fallback/secondary option since spec says "or both" is a valid answer but business chose SharePoint specifically).
- **Lock authority**: `weekly_report` lock/correct permission needs a way to designate additional users beyond Paul (e.g., a `can_lock_reports` flag on `program_manager`-role users, or an explicit designee list) — do not hardcode a name.
- **Approved-user management**: `approved_user` CRUD endpoints must authorize `program_manager` role generally (Paul, and any future PM-equivalent), not a single hardcoded user, consistent with §22's "do not hard-code named users" rule. Aidan/Jessica (`pm` role) also get this permission — an exception to their normal read/write scope per §5.2, so this needs an explicit permission check separate from their general PM-support permissions.
- **Risk matrix**: build `risk_severity_matrix` config table seeded with the values above; `riskSeverity()` in [snapshot.ts](../server/snapshot.ts) should read from config/DB instead of the hardcoded `SEVERITY_MATRIX` constant.
- **Invoice model**: current `invoices` table/fields already align with the sample PDF; add `voucher_id`, `clin_task_order_value`, `clin_task_order_funding` style fields only if a future slice needs to reproduce the full invoice document rather than just track payment status/aging.
- **Retention**: no TTL/cleanup jobs needed for `audit_event`, `authentication_event`, personnel, contract files, or weekly reports — explicitly do not build automatic purge logic.

## Source spec

Full governing document: `TechSur_Mission_Control_LLM_Build_Instructions.md` (copied into this folder from the user's Downloads for traceability).
