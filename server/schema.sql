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
