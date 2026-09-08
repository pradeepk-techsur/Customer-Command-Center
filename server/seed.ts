// Loads the source-of-record data into PostgreSQL. Idempotent: wipes and reloads portal tables
// (the audit log is preserved).
import { pool, withTransaction } from "./db.ts";
import { migrate } from "./migrate.ts";
import { DATA, WEEKLY_REPORTS, MONTHLY_REPORTS } from "./seed-data.ts";
import { parsePop, toIsoDate, firstOfMonth } from "./dates.ts";
import { hashPassword } from "./auth-service.ts";

const DEFAULT_STAMPS = { fin: "2026-08-31", people: "2026-09-02" };

export async function seed() {
  await migrate();
  await withTransaction(async (db) => {
    await db.query("truncate msr_sections, monthly_reports, weekly_report_items, weekly_reports, staff, labor_categories, call_orders restart identity cascade");
    
    // Seed test users with password "Password123!"
    const testPassword = await hashPassword("Password123!");
    const testUsers = [
      // Customers
      { email: "john.smith@acme.com", name: "John Smith", role: "customer" },
      { email: "jane.doe@example.com", name: "Jane Doe", role: "customer" },
      { email: "mike.wilson@demo.org", name: "Mike Wilson", role: "customer" },
      { email: "sarah.miller@test.com", name: "Sarah Miller", role: "customer" },
      { email: "robert.taylor@sample.net", name: "Robert Taylor", role: "customer" },
      // Program Managers (full access)
      { email: "ceenil.kaur@techsur.com", name: "Ceenil Kaur", role: "program_manager" },
      { email: "lauryn.brown@techsur.com", name: "Lauryn Brown", role: "program_manager" },
      // Project Managers (assigned call orders only)
      { email: "alex.johnson@techsur.com", name: "Alex Johnson", role: "pm" },
      { email: "maria.garcia@techsur.com", name: "Maria Garcia", role: "pm" },
      // Admin
      { email: "admin@techsur.com", name: "Admin User", role: "admin" },
    ];

    for (const user of testUsers) {
      await db.query(
        `insert into users (email, password_hash, name, role, auth_provider, status, created_at, updated_at)
         values ($1, $2, $3, $4, 'email', 'active', now(), now())
         on conflict (email) do nothing`,
        [user.email, testPassword, user.name, user.role]
      );
    }

    for (const [i, c] of DATA.entries()) {
      const { start, end } = parsePop(c.pop);
      await db.query(
        `insert into call_orders (id, group_key, group_name, name, pop_label, pop_start, pop_end, funded, spend, eac, over_under, pm, pending, highlights, fin_updated_on, people_updated_on, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,$13,$14,$15,$16)`,
        [c.id, c.group, c.groupName, c.name, c.pop, start, end, c.funded, c.spend, c.eac, c.over, c.pm,
         JSON.stringify(c.highlights), DEFAULT_STAMPS.fin, DEFAULT_STAMPS.people, i],
      );
      for (const [j, l] of c.lcats.entries()) {
        await db.query(
          "insert into labor_categories (call_order_id, name, fte, hours, rate, sort_order) values ($1,$2,$3,$4,$5,$6)",
          [c.id, l[0], l[1], l[2], l[3], j],
        );
      }
      for (const [j, s] of c.staff.entries()) {
        await db.query(
          "insert into staff (call_order_id, name, labor_category, rate, status, sort_order) values ($1,$2,$3,$4,$5,$6)",
          [c.id, s[0], s[1], s[2], s[3], j],
        );
      }
    }

    // Program-wide weekly touchpoint: one report, items filed per call order.
    for (const w of WEEKLY_REPORTS) {
      const { rows } = await db.query<{ id: number }>(
        `insert into weekly_reports (call_order_id, week_ending, week_label, file_name, submitted_by, status, href, created_in_portal)
         values (null, $1, $2, $3, $4, $5, $6, false) returning id`,
        [toIsoDate(w.week), w.week, w.file, w.by, w.status, w.href ? "/" + w.href : null],
      );
      const reportId = rows[0].id;
      for (const c of DATA) {
        for (const [j, text] of c.highlights.entries()) {
          await db.query(
            "insert into weekly_report_items (weekly_report_id, call_order_id, section_label, item_text, sort_order) values ($1,$2,$3,$4,$5)",
            [reportId, c.id, "Call order items", text, j],
          );
        }
      }
    }

    for (const m of MONTHLY_REPORTS) {
      const { rows } = await db.query<{ id: number }>(
        `insert into monthly_reports (period, period_start, file_name, submitted_by, due_on, status, href, scope, program)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
        [m.period, firstOfMonth(m.period), m.file, m.by, toIsoDate(m.due), m.status, m.href ? "/" + m.href : null, m.scope, JSON.stringify(m.program)],
      );
      const reportId = rows[0].id;
      for (const [callOrderId, s] of Object.entries(m.sections)) {
        await db.query(
          `insert into msr_sections (monthly_report_id, call_order_id, title, funding, completed, planned, risks, issues, travel, staffing, drafted)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false)`,
          [reportId, callOrderId, s.title,
           JSON.stringify(s.funding.map(([label, value]) => ({ label, value }))),
           JSON.stringify(s.completed.map(([title, text]) => ({ title, text }))),
           JSON.stringify(s.planned.map(([title, text]) => ({ title, text }))),
           JSON.stringify(s.risks), JSON.stringify(s.issues), s.travel,
           JSON.stringify(s.staffing.map(([division, name, start, lcat]) => ({ division, name, start, lcat })))],
        );
      }
    }
    
    // Seed test call order assignments for customers
    // Assign john.smith@acme.com to Call 002 (JDCN/Oracle Financials Cloud) and Call 003 (USCIS/ELIS/Modernization)
    // Assign jane.doe@example.com to Call 002 only
    const { rows: johnRows } = await db.query("select id from users where email = 'john.smith@acme.com'");
    const { rows: janeRows } = await db.query("select id from users where email = 'jane.doe@example.com'");
    
    if (johnRows.length > 0) {
      const johnId = johnRows[0].id;
      // Get first two non-pending call orders
      const { rows: callOrders } = await db.query("select id from call_orders where not pending order by sort_order limit 2");
      for (const co of callOrders) {
        await db.query(
          "insert into user_call_orders (user_id, call_order_id) values ($1, $2) on conflict do nothing",
          [johnId, co.id]
        );
      }
    }
    
    if (janeRows.length > 0) {
      const janeId = janeRows[0].id;
      // Get first call order
      const { rows: callOrders } = await db.query("select id from call_orders where not pending order by sort_order limit 1");
      if (callOrders.length > 0) {
        await db.query(
          "insert into user_call_orders (user_id, call_order_id) values ($1, $2) on conflict do nothing",
          [janeId, callOrders[0].id]
        );
      }
    }
    
    // Seed test call order assignments for Project Managers
    // Assign alex.johnson@techsur.com to Call 002 and Call 003
    // Assign maria.garcia@techsur.com to Call 001
    const { rows: alexRows } = await db.query("select id from users where email = 'alex.johnson@techsur.com'");
    const { rows: mariaRows } = await db.query("select id from users where email = 'maria.garcia@techsur.com'");
    
    if (alexRows.length > 0) {
      const alexId = alexRows[0].id;
      const { rows: callOrders } = await db.query("select id from call_orders where not pending order by sort_order offset 1 limit 2");
      for (const co of callOrders) {
        await db.query(
          "insert into user_call_orders (user_id, call_order_id) values ($1, $2) on conflict do nothing",
          [alexId, co.id]
        );
      }
    }
    
    if (mariaRows.length > 0) {
      const mariaId = mariaRows[0].id;
      // Get first call order only
      const { rows: callOrders } = await db.query("select id from call_orders where not pending order by sort_order limit 1");
      if (callOrders.length > 0) {
        await db.query(
          "insert into user_call_orders (user_id, call_order_id) values ($1, $2) on conflict do nothing",
          [mariaId, callOrders[0].id]
        );
      }
    }
  });
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seed()
    .then(() => { 
      console.log("Seeded " + DATA.length + " funded periods, " + MONTHLY_REPORTS.length + " monthly report(s), and 10 test users."); 
      console.log("\nTest user credentials (password for all users: Password123!):");
      console.log("  Customers:");
      console.log("    - john.smith@acme.com (assigned to 2 call orders)");
      console.log("    - jane.doe@example.com (assigned to 1 call order)");
      console.log("    - mike.wilson@demo.org, sarah.miller@test.com, robert.taylor@sample.net (no assignments)");
      console.log("  Program Managers: ceenil.kaur@techsur.com, lauryn.brown@techsur.com (full access, can manage MSRs)");
      console.log("  Project Managers: alex.johnson@techsur.com (assigned to 2 call orders), maria.garcia@techsur.com (assigned to 1 call order)");
      console.log("  Admin: admin@techsur.com (full access)");
      return pool.end(); 
    })
    .catch((err) => { console.error(err); process.exit(1); });
}
