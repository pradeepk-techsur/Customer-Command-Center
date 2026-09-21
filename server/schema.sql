-- Contract Transparency Portal — PostgreSQL schema
-- Money is numeric(14,2); dates are DATE (no time component is meaningful in the source data).

create table if not exists call_orders (
  id                text primary key,                 -- funded period identifier, e.g. "Call 2.3"
  group_key         text not null,                    -- call order, e.g. "Call 002"
  group_name        text not null,
  name              text not null,
  pop_label         text not null,                    -- period of performance as written in the source
  pop_start         date,
  pop_end           date,
  funded            numeric(14,2) not null default 0, -- funds obligated
  spend             numeric(14,2) not null default 0, -- funds expended to date
  eac               numeric(14,2),                    -- estimate at completion
  over_under        numeric(14,2),
  pm                text not null default '—',
  pending           boolean not null default false,   -- uploaded, awaiting setup
  highlights        jsonb not null default '[]'::jsonb, -- weekly touchpoint items for this call order
  fin_updated_on    date not null default current_date,
  people_updated_on date not null default current_date,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

create table if not exists labor_categories (
  id            serial primary key,
  call_order_id text not null references call_orders(id) on delete cascade,
  name          text not null,
  fte           numeric(6,2) not null,
  hours         integer not null,
  rate          numeric(10,2) not null,
  sort_order    integer not null default 0
);
create index if not exists labor_categories_call_order_idx on labor_categories(call_order_id);

create table if not exists staff (
  id             serial primary key,
  call_order_id  text not null references call_orders(id) on delete cascade,
  name           text not null,
  labor_category text not null,
  rate           numeric(10,2) not null default 0,
  status         text not null default 'Assigned',
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists staff_call_order_idx on staff(call_order_id);

-- Weekly status reports. call_order_id is NULL for a program-wide touchpoint that covers every
-- call order; its per-call-order items live in weekly_report_items.
create table if not exists weekly_reports (
  id                serial primary key,
  call_order_id     text references call_orders(id) on delete cascade,
  week_ending       date,
  week_label        text not null,
  file_name         text not null,
  submitted_by      text not null default '',
  status            text not null default 'Submitted',   -- Submitted | Uploaded
  href              text,                                 -- only set when a real file backs it
  created_in_portal boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists weekly_reports_call_order_idx on weekly_reports(call_order_id);

-- Add columns for weekly report enhancements
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'weekly_reports' and column_name = 'status_v2') then
    alter table weekly_reports add column status_v2 text default 'submitted' check (status_v2 in ('draft', 'submitted', 'uploaded'));
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'weekly_reports' and column_name = 'created_by_user_id') then
    alter table weekly_reports add column created_by_user_id integer references users(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'weekly_reports' and column_name = 'submitted_at') then
    alter table weekly_reports add column submitted_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'weekly_reports' and column_name = 'last_edited_at') then
    alter table weekly_reports add column last_edited_at timestamptz;
  end if;
end $$;

-- Consolidated weekly reports: Program Manager compiles all call order reports for a week
create table if not exists consolidated_weekly_reports (
  id                    serial primary key,
  week_ending           date not null unique,
  week_label            text not null,
  status                text not null default 'draft' check (status in ('draft', 'submitted')),
  customer_visible      boolean not null default false,
  customer_released_at  timestamptz,
  customer_released_by  integer references users(id),
  created_by            integer not null references users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists consolidated_weekly_reports_week_idx on consolidated_weekly_reports(week_ending);
create index if not exists consolidated_weekly_reports_status_idx on consolidated_weekly_reports(status);

create table if not exists weekly_report_items (
  id               serial primary key,
  weekly_report_id integer not null references weekly_reports(id) on delete cascade,
  call_order_id    text not null references call_orders(id) on delete cascade,
  section_label    text not null,
  item_text        text not null,
  sort_order       integer not null default 0
);
create index if not exists weekly_report_items_report_idx on weekly_report_items(weekly_report_id, call_order_id);

-- Monthly status reports: one BPA-level deliverable per reporting period.
create table if not exists monthly_reports (
  id           serial primary key,
  period       text not null,            -- "June 2026"
  period_start date,
  file_name    text not null,
  submitted_by text not null default 'Program Office',
  due_on       date,
  status       text not null default 'Draft',  -- Draft | Submitted | Accepted | Uploaded
  href         text,
  scope        text,
  program      jsonb,                    -- new contractors, departures, movement
  created_at   timestamptz not null default now()
);

create table if not exists msr_sections (
  id                serial primary key,
  monthly_report_id integer not null references monthly_reports(id) on delete cascade,
  call_order_id     text not null references call_orders(id) on delete cascade,
  title             text,
  funding           jsonb not null default '[]'::jsonb,   -- [{label, value}]
  completed         jsonb not null default '[]'::jsonb,   -- [{title, text}]
  planned           jsonb not null default '[]'::jsonb,   -- [{title, text}]
  risks             jsonb not null default '[]'::jsonb,   -- [string]
  issues            jsonb not null default '[]'::jsonb,   -- [string]
  travel            text not null default 'N/A',
  staffing          jsonb,                                -- [{division, name, start, lcat}]
  drafted           boolean not null default false,       -- assembled from portal data
  updated_at        timestamptz not null default now(),
  unique (monthly_report_id, call_order_id)
);

-- Every change is attributed to a user and retained.
create table if not exists audit_log (
  id          bigserial primary key,
  actor       text not null,
  role        text not null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists audit_log_entity_idx on audit_log(entity, entity_id);

-- Add user_id column if it doesn't exist (for migration from pre-auth schema)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'audit_log' and column_name = 'user_id'
  ) then
    alter table audit_log add column user_id integer;
    create index audit_log_user_idx on audit_log(user_id);
  end if;
end $$;

-- Add snapshot references to audit_log
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'audit_log' and column_name = 'snapshot_id'
  ) then
    alter table audit_log add column snapshot_id bigint;
    alter table audit_log add column snapshot_type text check (snapshot_type in ('call_order', 'staff'));
  end if;
end $$;

-- ============================================================================
-- Audit History & Snapshots
-- ============================================================================

-- Call order snapshots: capture full financial state at each change
create table if not exists call_order_snapshots (
  id                bigserial primary key,
  call_order_id     text not null references call_orders(id) on delete cascade,
  snapshot_time     timestamptz not null default now(),
  -- Financial data
  funded            numeric(14,2) not null,
  spend             numeric(14,2) not null,
  eac               numeric(14,2),
  over_under        numeric(14,2),
  -- Metadata
  pm                text not null,
  pop_start         date,
  pop_end           date,
  pop_label         text not null,
  pending           boolean not null,
  -- Audit trail
  created_by_user_id integer references users(id),
  change_reason      text,
  changed_fields     jsonb,  -- Array of field names that changed
  created_at        timestamptz not null default now()
);
create index if not exists call_order_snapshots_call_order_idx on call_order_snapshots(call_order_id, snapshot_time desc);
create index if not exists call_order_snapshots_time_idx on call_order_snapshots(snapshot_time desc);
create index if not exists call_order_snapshots_user_idx on call_order_snapshots(created_by_user_id);

-- Staff snapshots: capture full roster state at each change
create table if not exists staff_snapshots (
  id                bigserial primary key,
  call_order_id     text not null references call_orders(id) on delete cascade,
  snapshot_time     timestamptz not null default now(),
  -- Staff roster as JSONB array: [{id, name, labor_category, rate, status, sort_order}]
  staff_roster      jsonb not null default '[]'::jsonb,
  -- Audit trail
  created_by_user_id integer references users(id),
  change_reason      text,
  change_type        text,  -- 'add' | 'update' | 'delete'
  changed_staff_id   integer,  -- ID of staff member that changed
  created_at        timestamptz not null default now()
);
create index if not exists staff_snapshots_call_order_idx on staff_snapshots(call_order_id, snapshot_time desc);
create index if not exists staff_snapshots_time_idx on staff_snapshots(snapshot_time desc);
create index if not exists staff_snapshots_user_idx on staff_snapshots(created_by_user_id);

-- ============================================================================
-- Authentication & User Management
-- ============================================================================

-- User accounts: both TechSur PMs (Microsoft auth) and external customers (email/password)
create table if not exists users (
  id                  serial primary key,
  email               text not null unique,
  password_hash       text,                               -- NULL for Microsoft auth users
  name                text not null,
  role                text not null check (role in ('customer', 'pm', 'admin', 'program_manager')),
  auth_provider       text not null check (auth_provider in ('email', 'microsoft')),
  azure_oid           text,                               -- Azure AD object ID for Microsoft users
  status              text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  must_reset_password boolean not null default false,     -- Force password change on first login
  last_login_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists users_email_idx on users(lower(email));
create index if not exists users_azure_oid_idx on users(azure_oid) where azure_oid is not null;
create index if not exists users_role_idx on users(role);
create index if not exists users_status_idx on users(status);

-- Active sessions with JWT tokens
create table if not exists sessions (
  id         serial primary key,
  user_id    integer not null references users(id) on delete cascade,
  token      text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists sessions_token_idx on sessions(token);
create index if not exists sessions_expires_idx on sessions(expires_at);

-- Password reset tokens for email/password users
create table if not exists password_resets (
  id         serial primary key,
  user_id    integer not null references users(id) on delete cascade,
  token      text not null unique,
  expires_at timestamptz not null,
  used       boolean not null default false,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user_idx on password_resets(user_id);
create index if not exists password_resets_token_idx on password_resets(token);

-- Future: Granular per-call-order access control
-- By default, all users see all call orders (current behavior)
-- This table allows restricting specific users to specific call orders
create table if not exists user_call_orders (
  user_id       integer not null references users(id) on delete cascade,
  call_order_id text not null references call_orders(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, call_order_id)
);
create index if not exists user_call_orders_user_idx on user_call_orders(user_id);
create index if not exists user_call_orders_call_order_idx on user_call_orders(call_order_id);

-- ============================================================================
-- Migration: Add program_manager role
-- ============================================================================

-- Note: Role constraint updated to support both 'pm' (Project Manager) and 'program_manager' (Program Manager)
-- The constraint check is handled by PostgreSQL's built-in validation
-- ============================================================================
-- Migration: Add status reporting enhancements
-- ============================================================================

-- Phase 1: Weekly reports draft/submit functionality
ALTER TABLE weekly_reports 
  ADD COLUMN IF NOT EXISTS status_v2 text DEFAULT 'draft' 
    CHECK (status_v2 IN ('draft', 'submitted', 'uploaded'));

ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz DEFAULT now();

-- Migrate existing data
UPDATE weekly_reports 
  SET status_v2 = CASE 
    WHEN status = 'Submitted' THEN 'submitted'
    WHEN status = 'Uploaded' THEN 'uploaded'
    ELSE 'draft'
  END
  WHERE status_v2 IS NULL;

UPDATE weekly_reports 
  SET submitted_at = created_at 
  WHERE status_v2 IN ('submitted', 'uploaded') AND submitted_at IS NULL;

-- Phase 2: PM monthly report creation
ALTER TABLE monthly_reports
  ADD COLUMN IF NOT EXISTS created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE monthly_reports
  ADD COLUMN IF NOT EXISTS report_type text DEFAULT 'program' 
    CHECK (report_type IN ('program', 'pm'));

ALTER TABLE monthly_reports
  ADD COLUMN IF NOT EXISTS parent_report_id integer REFERENCES monthly_reports(id) ON DELETE SET NULL;

-- Index for finding PM reports
CREATE INDEX IF NOT EXISTS idx_monthly_reports_pm 
  ON monthly_reports(created_by_user_id, period) 
  WHERE report_type = 'pm';

-- Phase 6: Customer access control
ALTER TABLE monthly_reports
  ADD COLUMN IF NOT EXISTS customer_visible boolean DEFAULT false;

-- Phase 7: Customer invitation and password reset
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_reset_password boolean NOT NULL DEFAULT false;

ALTER TABLE monthly_reports
  ADD COLUMN IF NOT EXISTS customer_released_at timestamptz;

ALTER TABLE monthly_reports
  ADD COLUMN IF NOT EXISTS customer_released_by integer REFERENCES users(id) ON DELETE SET NULL;

-- Index for customer queries
CREATE INDEX IF NOT EXISTS idx_monthly_reports_customer_visible
  ON monthly_reports(customer_visible, period_start DESC)
  WHERE customer_visible = true;

-- ============================================================================
-- Contract Tab: BPA record, CLINs, invoices, contract documents, deliverables
-- ============================================================================

-- The single BPA award. One row expected; replaces the hardcoded CONTRACT constant.
create table if not exists contracts (
  id         serial primary key,
  name       text not null,
  agency     text not null,
  vehicle    text not null,
  number     text not null,
  pop_start  date,
  pop_end    date,
  funded     numeric(14,2) not null default 0,
  spend      numeric(14,2) not null default 0,
  eac        numeric(14,2),
  created_at timestamptz not null default now()
);

-- CLINs. call_order_id NULL = BPA-level CLIN.
create table if not exists clins (
  id            serial primary key,
  call_order_id text references call_orders(id) on delete cascade,
  name          text not null,
  funded_amount numeric(14,2) not null default 0,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists clins_call_order_idx on clins(call_order_id);

-- Monthly projected/actual spend per CLIN, drives the spend line graph.
create table if not exists clin_monthly_spend (
  id                 serial primary key,
  clin_id            integer not null references clins(id) on delete cascade,
  month              date not null,             -- first of month
  projected_amount   numeric(14,2),
  actual_amount      numeric(14,2),
  unique (clin_id, month)
);
create index if not exists clin_monthly_spend_clin_idx on clin_monthly_spend(clin_id, month);

-- Invoices. call_order_id NULL = BPA-level invoice.
create table if not exists invoices (
  id             serial primary key,
  call_order_id  text references call_orders(id) on delete cascade,
  invoice_number text not null,
  invoice_date   date not null,
  amount         numeric(14,2) not null,
  period_start   date,
  period_end     date,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  paid_date      date,
  file_href      text,
  created_at     timestamptz not null default now()
);
create index if not exists invoices_call_order_idx on invoices(call_order_id);

-- Award document + contract mods. call_order_id NULL = BPA-level document.
create table if not exists contract_documents (
  id                   serial primary key,
  call_order_id        text references call_orders(id) on delete cascade,
  name                 text not null,
  file_href            text,
  is_admin_mod         boolean not null default false,
  is_funding_mod       boolean not null default false,
  funding_change_amount numeric(14,2),
  pop_period_label     text,                    -- e.g. "Base", "Option 1"
  effective_date       date,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now()
);
create index if not exists contract_documents_call_order_idx on contract_documents(call_order_id);

-- Contractual deliverables. Link is either an uploaded file or an external URL (e.g. AO SharePoint).
create table if not exists deliverables (
  id                serial primary key,
  call_order_id     text references call_orders(id) on delete cascade,
  name              text not null,
  link_type         text not null check (link_type in ('file', 'url')),
  file_href         text,
  url               text,
  due_date          date,
  delivery_date     date,
  status            text not null default 'pending' check (status in ('pending', 'delivered', 'accepted')),
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists deliverables_call_order_idx on deliverables(call_order_id);

-- ============================================================================
-- Risks, Issues, Action Items
-- ============================================================================

-- call_order_id NULL = BPA-level risk.
create table if not exists risks (
  id           serial primary key,
  call_order_id text references call_orders(id) on delete cascade,
  description  text not null,
  probability  text not null check (probability in ('low', 'medium', 'high')),
  impact       text not null check (impact in ('low', 'medium', 'high')),
  mitigation   text,
  status       text not null default 'open' check (status in ('open', 'closed')),
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);
create index if not exists risks_call_order_idx on risks(call_order_id);

-- call_order_id NULL = BPA-level issue.
create table if not exists issues (
  id                serial primary key,
  call_order_id     text references call_orders(id) on delete cascade,
  description       text not null,
  date_identified   date not null default current_date,
  assigned_to       text,
  status            text not null default 'open' check (status in ('open', 'closed')),
  updates_narrative jsonb not null default '[]'::jsonb,  -- [{date, text}]
  created_at        timestamptz not null default now(),
  closed_at         timestamptz
);
create index if not exists issues_call_order_idx on issues(call_order_id);

-- Action items live under a weekly report (per call order) or standalone at the BPA level.
create table if not exists action_items (
  id                serial primary key,
  weekly_report_id  integer references weekly_reports(id) on delete cascade,
  call_order_id     text references call_orders(id) on delete cascade,
  name              text not null,
  description       text,
  date_assigned     date not null default current_date,
  status            text not null default 'open' check (status in ('open', 'closed')),
  created_at        timestamptz not null default now(),
  closed_at         timestamptz
);
create index if not exists action_items_call_order_idx on action_items(call_order_id);
create index if not exists action_items_weekly_report_idx on action_items(weekly_report_id);

-- ============================================================================
-- Mission Control Slice 1: Approved-user allowlist, magic-link auth, auth events
-- ============================================================================

-- Password-free customer allowlist. Managed by program_manager and pm roles (Paul, Aidan, Jessica) per decision #4.
create table if not exists approved_users (
  id           serial primary key,
  email        text not null unique,
  name         text not null,
  role         text not null default 'customer' check (role in ('customer', 'pm', 'program_manager')),
  added_by_user_id integer references users(id) on delete set null,
  status       text not null default 'active' check (status in ('active', 'revoked')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists approved_users_email_idx on approved_users(lower(email));

-- Single-use magic-link tokens. Only a hash of the token is stored (never the plaintext token).
create table if not exists magic_link_tokens (
  id              serial primary key,
  approved_user_id integer not null references approved_users(id) on delete cascade,
  token_hash      text not null unique,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  requested_ip    text,
  created_at      timestamptz not null default now()
);
create index if not exists magic_link_tokens_expires_idx on magic_link_tokens(expires_at);
create index if not exists magic_link_tokens_approved_user_idx on magic_link_tokens(approved_user_id);

-- Authentication/security event log. Never visible to customer-role users (§19.4/§19.5).
create table if not exists authentication_events (
  id            bigserial primary key,
  event_type    text not null check (event_type in (
                   'magic_link_requested', 'magic_link_approved', 'magic_link_rejected',
                   'magic_link_issued', 'magic_link_used', 'magic_link_reuse_attempt',
                   'magic_link_expired_attempt', 'magic_link_invalid_attempt',
                   'sso_success', 'sso_failure', 'session_start', 'session_end'
                 )),
  email         text,                 -- the address attempted, when applicable (privacy-minimizing; no raw token)
  user_id       integer references users(id) on delete set null,
  role_assigned text,
  ip_address    text,
  details       jsonb,
  occurred_at   timestamptz not null default now()
);
create index if not exists authentication_events_type_idx on authentication_events(event_type);
create index if not exists authentication_events_email_idx on authentication_events(email);
create index if not exists authentication_events_time_idx on authentication_events(occurred_at desc);

-- Configuration-driven risk severity matrix (§14). Seeded with the standard 3x3 IT-program matrix (decision #3);
-- not hardcoded, so it can be edited without a deploy.
create table if not exists risk_severity_matrix (
  probability text not null check (probability in ('low', 'medium', 'high')),
  impact      text not null check (impact in ('low', 'medium', 'high')),
  severity    text not null check (severity in ('low', 'medium', 'high')),
  primary key (probability, impact)
);
insert into risk_severity_matrix (probability, impact, severity) values
  ('low', 'low', 'low'), ('low', 'medium', 'low'), ('low', 'high', 'medium'),
  ('medium', 'low', 'low'), ('medium', 'medium', 'medium'), ('medium', 'high', 'high'),
  ('high', 'low', 'medium'), ('high', 'medium', 'high'), ('high', 'high', 'high')
on conflict (probability, impact) do nothing;

-- Lock/correct authority for weekly reports (§17.7, decision #10): program_manager always has it;
-- this flag lets Paul designate additional lockers without granting them the full program_manager role.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'users' and column_name = 'can_lock_reports') then
    alter table users add column can_lock_reports boolean not null default false;
  end if;
end $$;
-- Staffing overhaul: onboarding, equipment, transfers
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'staff' and column_name = 'ao_email') then
    alter table staff add column ao_email text;
    alter table staff add column phone text;
    alter table staff add column start_date date;
    alter table staff add column end_date date;
    alter table staff add column offer_accepted_date date;
    alter table staff add column of306_submitted_date date;
    alter table staff add column fingerprints_complete_date date;
    alter table staff add column laptop_received_date date;
    alter table staff add column piv_issued_date date;
    alter table staff add column property_return_doc_href text;
  end if;
end $$;

-- Supports more than one laptop per person (generally one, but not always).
create table if not exists staff_equipment (
  id                   serial primary key,
  staff_id             integer not null references staff(id) on delete cascade,
  make_model           text not null,
  property_tag_number  text,
  created_at           timestamptz not null default now()
);
create index if not exists staff_equipment_staff_idx on staff_equipment(staff_id);

-- Planned or completed LCAT/call-order moves, tracked separately since moves can be future-dated.
create table if not exists staff_transfers (
  id                serial primary key,
  staff_id          integer not null references staff(id) on delete cascade,
  from_call_order_id text references call_orders(id) on delete set null,
  from_lcat         text,
  to_call_order_id  text references call_orders(id) on delete set null,
  to_lcat           text,
  effective_date    date not null,
  notes             text,
  status            text not null default 'pending' check (status in ('pending', 'completed')),
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);
create index if not exists staff_transfers_staff_idx on staff_transfers(staff_id);

-- Tracks whether an open billet is being sourced, on hold, or has a resource onboarding.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'labor_categories' and column_name = 'vacancy_status') then
    alter table labor_categories add column vacancy_status text check (vacancy_status in ('sourcing', 'on_hold', 'onboarding'));
  end if;
end $$;

-- Free-text deliverable category (e.g. "Monthly Status Report") and the reporting month/year it covers.
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS period_label text;

-- Free-text description shown on the call order's General tab.
ALTER TABLE call_orders ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- Labor category snapshots: same pattern as staff_snapshots, captures full LCAT list at each change.
create table if not exists labor_category_snapshots (
  id                bigserial primary key,
  call_order_id     text not null references call_orders(id) on delete cascade,
  snapshot_time     timestamptz not null default now(),
  -- Labor category list as JSONB array: [{id, name, fte, hours, rate, sort_order}]
  labor_categories  jsonb not null default '[]'::jsonb,
  created_by_user_id integer references users(id),
  change_reason      text,
  change_type        text,  -- 'add' | 'update' | 'delete'
  changed_lcat_id    integer,
  created_at        timestamptz not null default now()
);
create index if not exists labor_category_snapshots_call_order_idx on labor_category_snapshots(call_order_id, snapshot_time desc);

-- Contract document snapshots: same pattern, captures full contract-file list at each change
-- (uploads, and PM corrections to mis-parsed PoP grouping / admin vs funding mod classification).
create table if not exists contract_document_snapshots (
  id                bigserial primary key,
  call_order_id     text not null references call_orders(id) on delete cascade,
  snapshot_time     timestamptz not null default now(),
  -- Contract document list as JSONB array: [{id, name, isAdminMod, isFundingMod, fundingChangeAmount, popPeriodLabel, effectiveDate, sortOrder}]
  contract_documents jsonb not null default '[]'::jsonb,
  created_by_user_id integer references users(id),
  change_reason      text,
  change_type        text,  -- 'add' | 'update' | 'delete'
  changed_document_id integer,
  created_at        timestamptz not null default now()
);
create index if not exists contract_document_snapshots_call_order_idx on contract_document_snapshots(call_order_id, snapshot_time desc);
-- Offboarding: date equipment was physically returned, separate from the property return document upload.
ALTER TABLE staff ADD COLUMN IF NOT EXISTS equipment_returned_date date;