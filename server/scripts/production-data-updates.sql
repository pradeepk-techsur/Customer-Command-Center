begin;

insert into call_orders (
  id,
  group_key,
  group_name,
  name,
  description,
  narrative,
  pop_label,
  pop_start,
  pop_end,
  funded,
  spend,
  eac,
  over_under,
  pm,
  pending,
  highlights,
  fin_updated_on,
  people_updated_on,
  sort_order
)
values (
  'Call 20',
  'Call 020',
  'Enterprise Architecture Support',
  'Enterprise Architecture Support',
  'Enterprise Architecture program support spanning governance, IT standards, security, solution, cloud, audiovisual, data, application, and business architecture services.',
  '',
  '9/25/26 - 9/24/27',
  date '2026-09-25',
  date '2027-09-24',
  5447029.88,
  0,
  null,
  null,
  'Ceenil Kaur',
  false,
  '[]'::jsonb,
  date '2026-09-25',
  date '2026-09-25',
  coalesce((select max(sort_order) + 1 from call_orders), 0)
)
on conflict (id) do nothing;

update call_orders
set group_name = 'Research, Architecture & Engineering Support',
    name = 'Research, Architecture & Engineering Support'
where group_key = 'Call 016'
  and (
    group_name is distinct from 'Research, Architecture & Engineering Support'
    or name is distinct from 'Research, Architecture & Engineering Support'
  );

commit;
