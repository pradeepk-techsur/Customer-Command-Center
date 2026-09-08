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