import express from "express";
import cors from "cors";
import multer from "multer";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { pool, withTransaction } from "./db.ts";
import { migrate } from "./migrate.ts";
import { actorOf, requirePm } from "./auth.ts";
import { buildSnapshot } from "./snapshot.ts";
import { dayLabel, firstOfMonth, monthLabel, toIsoDate } from "./dates.ts";
import type { MsrSectionInput, WeeklyReportInput } from "../shared/types.ts";
import { WEEKLY_SECTIONS } from "../shared/types.ts";
import type pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const uploadsDir = join(root, "uploads");
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const safe = basename(file.originalname).replace(/[^\w.\- ]+/g, "_");
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir));

type Db = pg.PoolClient;

async function audit(db: Db, req: express.Request, action: string, entity: string, entityId: string | number | null, details?: unknown) {
  const actor = actorOf(req);
  await db.query(
    "insert into audit_log (actor, role, action, entity, entity_id, details) values ($1,$2,$3,$4,$5,$6)",
    [actor.name, actor.role, action, entity, entityId === null ? null : String(entityId), details === undefined ? null : JSON.stringify(details)],
  );
}

const lines = (v: unknown): string[] => Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
};
const orNA = (xs: string[]) => (xs.length ? xs : ["N/A"]);

async function callOrderOr404(db: pg.Pool | Db, id: string, res: express.Response) {
  const { rows } = await db.query("select * from call_orders where id = $1", [id]);
  if (!rows[0]) { res.status(404).json({ error: "Call order not found." }); return null; }
  return rows[0];
}

/** Wraps a PM mutation in a transaction and answers with the refreshed snapshot. */
function mutation(fn: (db: Db, req: express.Request, res: express.Response) => Promise<boolean | void>) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const snapshot = await withTransaction(async (db) => {
        const ok = await fn(db, req, res);
        if (ok === false) return null;
        return buildSnapshot(db);
      });
      if (snapshot) res.json(snapshot);
    } catch (err) { next(err); }
  };
}

app.get("/api/health", async (_req, res, next) => {
  try { await pool.query("select 1"); res.json({ ok: true }); } catch (err) { next(err); }
});

app.get("/api/portal", async (_req, res, next) => {
  try { res.json(await buildSnapshot(pool)); } catch (err) { next(err); }
});

app.get("/api/audit", requirePm, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const { rows } = await pool.query("select * from audit_log order by occurred_at desc, id desc limit $1", [limit]);
    res.json(rows);
  } catch (err) { next(err); }
});

// ---- Call orders -------------------------------------------------------------------------------

app.post("/api/call-orders/upload", requirePm, upload.array("files"), mutation(async (db, req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) { res.status(400).json({ error: "No files were uploaded." }); return false; }
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from call_orders where pending");
  let n = rows[0].n;
  for (const f of files) {
    n += 1;
    const id = `New ${n}`;
    const name = f.originalname.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    await db.query(
      `insert into call_orders (id, group_key, group_name, name, pop_label, funded, spend, pm, pending, highlights, sort_order)
       values ($1,$1,$2,$2,'To be entered',0,0,'Unassigned',true,$3,-1)`,
      [id, name, JSON.stringify([`Uploaded from ${f.originalname}. Funding, staffing, and period of performance pending setup.`])],
    );
    await audit(db, req, "call_order.upload", "call_order", id, { file: f.originalname, stored: `/uploads/${f.filename}` });
  }
}));

app.patch("/api/call-orders/:id/spend", requirePm, mutation(async (db, req, res) => {
  const c = await callOrderOr404(db, req.params.id as string, res);
  if (!c) return false;
  const spend = num(req.body?.spend);
  if (spend === null || spend < 0) { res.status(400).json({ error: "Funds expended must be a non-negative amount." }); return false; }
  await db.query("update call_orders set spend = $2, fin_updated_on = current_date where id = $1", [c.id, spend]);
  await audit(db, req, "call_order.spend", "call_order", c.id, { from: c.spend, to: spend });
}));

// ---- Staff -------------------------------------------------------------------------------------

app.post("/api/call-orders/:id/staff", requirePm, mutation(async (db, req, res) => {
  const c = await callOrderOr404(db, req.params.id as string, res);
  if (!c) return false;
  const name = String(req.body?.name || "").trim();
  if (!name) { res.status(400).json({ error: "A name is required." }); return false; }
  const laborCategory = String(req.body?.laborCategory || "").trim() || "—";
  const rate = num(req.body?.rate) ?? 0;
  const { rows } = await db.query<{ id: number }>(
    `insert into staff (call_order_id, name, labor_category, rate, status, sort_order)
     values ($1,$2,$3,$4,'Onboarding', coalesce((select max(sort_order) + 1 from staff where call_order_id = $1), 0)) returning id`,
    [c.id, name, laborCategory, rate],
  );
  await db.query("update call_orders set people_updated_on = current_date where id = $1", [c.id]);
  await audit(db, req, "staff.add", "staff", rows[0].id, { callOrderId: c.id, name, laborCategory, rate });
}));

app.patch("/api/staff/:id", requirePm, mutation(async (db, req, res) => {
  const { rows } = await db.query("select * from staff where id = $1", [req.params.id]);
  const s = rows[0];
  if (!s) { res.status(404).json({ error: "Staff record not found." }); return false; }
  const status = String(req.body?.status || "").trim();
  if (!status) { res.status(400).json({ error: "A status is required." }); return false; }
  await db.query("update staff set status = $2 where id = $1", [s.id, status]);
  await db.query("update call_orders set people_updated_on = current_date where id = $1", [s.call_order_id]);
  await audit(db, req, "staff.status", "staff", s.id, { callOrderId: s.call_order_id, name: s.name, from: s.status, to: status });
}));

app.delete("/api/staff/:id", requirePm, mutation(async (db, req, res) => {
  const { rows } = await db.query("delete from staff where id = $1 returning *", [req.params.id]);
  const s = rows[0];
  if (!s) { res.status(404).json({ error: "Staff record not found." }); return false; }
  await db.query("update call_orders set people_updated_on = current_date where id = $1", [s.call_order_id]);
  await audit(db, req, "staff.remove", "staff", s.id, { callOrderId: s.call_order_id, name: s.name, laborCategory: s.labor_category, status: s.status });
}));

// ---- Weekly status reports ---------------------------------------------------------------------

app.post("/api/call-orders/:id/weekly-reports", requirePm, mutation(async (db, req, res) => {
  const c = await callOrderOr404(db, req.params.id as string, res);
  if (!c) return false;
  const body = (req.body || {}) as Partial<WeeklyReportInput>;
  const weekLabel = String(body.weekEnding || "").trim() || dayLabel();
  const submittedBy = String(body.submittedBy || "").trim() || "Project Manager";
  const { rows } = await db.query<{ id: number }>(
    `insert into weekly_reports (call_order_id, week_ending, week_label, file_name, submitted_by, status, href, created_in_portal)
     values ($1,$2,$3,'Weekly Status Report (created in portal)',$4,'Submitted',null,true) returning id`,
    [c.id, toIsoDate(weekLabel), weekLabel, submittedBy],
  );
  const reportId = rows[0].id;
  const sections: [string, string[]][] = [
    [WEEKLY_SECTIONS.accomplishments, lines(body.accomplishments)],
    [WEEKLY_SECTIONS.planned, lines(body.planned)],
    [WEEKLY_SECTIONS.risks, orNA(lines(body.risks))],
    [WEEKLY_SECTIONS.issues, orNA(lines(body.issues))],
    [WEEKLY_SECTIONS.actions, orNA(lines(body.actions))],
  ];
  let order = 0;
  for (const [label, items] of sections) {
    for (const text of items) {
      await db.query(
        "insert into weekly_report_items (weekly_report_id, call_order_id, section_label, item_text, sort_order) values ($1,$2,$3,$4,$5)",
        [reportId, c.id, label, text, order++],
      );
    }
  }
  await audit(db, req, "weekly_report.create", "weekly_report", reportId, { callOrderId: c.id, weekEnding: weekLabel, submittedBy });
}));

app.post("/api/call-orders/:id/weekly-reports/upload", requirePm, upload.array("files"), mutation(async (db, req, res) => {
  const c = await callOrderOr404(db, req.params.id as string, res);
  if (!c) return false;
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) { res.status(400).json({ error: "No files were uploaded." }); return false; }
  const by = c.pm === "—" ? "Program Office" : c.pm;
  for (const f of files) {
    const { rows } = await db.query<{ id: number }>(
      `insert into weekly_reports (call_order_id, week_ending, week_label, file_name, submitted_by, status, href, created_in_portal)
       values ($1, current_date, $2, $3, $4, 'Uploaded', $5, false) returning id`,
      [c.id, dayLabel(), f.originalname, by, `/uploads/${f.filename}`],
    );
    await audit(db, req, "weekly_report.upload", "weekly_report", rows[0].id, { callOrderId: c.id, file: f.originalname });
  }
}));

// ---- Monthly status reports --------------------------------------------------------------------

async function insertMonthly(db: Db, period: string, file: string, status: string, href: string | null) {
  const { rows } = await db.query<{ id: number }>(
    `insert into monthly_reports (period, period_start, file_name, submitted_by, due_on, status, href)
     values ($1,$2,$3,'Program Office',null,$4,$5) returning id`,
    [period, firstOfMonth(period), file, status, href],
  );
  return rows[0].id;
}

app.post("/api/monthly-reports", requirePm, mutation(async (db, req) => {
  const period = String(req.body?.period || "").trim() || monthLabel();
  const mode = req.body?.mode === "draft" ? "draft" : "blank";
  if (mode === "blank") {
    const id = await insertMonthly(db, period, `MSR ${period} (in progress)`, "Draft", null);
    await audit(db, req, "monthly_report.create", "monthly_report", id, { period, mode });
    return;
  }

  // Draft from portal data: funding from the portal, activity from the weekly reports PMs authored
  // in the reporting period (all authored reports when the period cannot be dated).
  const id = await insertMonthly(db, period, `MSR ${period} (drafted in portal)`, "Draft", null);
  const start = firstOfMonth(period);
  const end = start ? (() => { const d = new Date(start + "T00:00:00"); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); })() : null;
  const { rows: orders } = await db.query("select * from call_orders where not pending order by sort_order");
  const { rows: weeklies } = await db.query(
    `select r.*, i.section_label, i.item_text, i.sort_order as item_order
       from weekly_reports r join weekly_report_items i on i.weekly_report_id = r.id
      where r.created_in_portal and ($1::date is null or r.week_ending is null or (r.week_ending >= $1 and r.week_ending < $2))
      order by r.week_ending, r.id, i.sort_order`,
    [start, end],
  );
  for (const c of orders) {
    const mine = weeklies.filter((w) => w.call_order_id === c.id);
    const byReport = new Map<number, typeof mine>();
    for (const w of mine) { const l = byReport.get(w.id) || []; l.push(w); byReport.set(w.id, l); }
    const pull = (label: string) => [...byReport.values()].map((items) => {
      const xs = items.filter((i) => i.section_label === label && i.item_text !== "N/A").map((i) => i.item_text);
      return xs.length ? { title: "Week ending " + items[0].week_label, text: xs.join("; ") } : null;
    }).filter((x): x is { title: string; text: string } => !!x);
    const flat = (label: string) => mine.filter((i) => i.section_label === label && i.item_text !== "N/A").map((i) => i.item_text);
    const funding = [
      { label: "Funds Obligated", value: c.funded }, { label: "Funds Expended to Date", value: c.spend },
      { label: "Funds Remaining", value: c.funded - c.spend }, { label: "Estimate at Completion", value: c.eac },
      { label: "Over/Under", value: c.over_under },
    ];
    await db.query(
      `insert into msr_sections (monthly_report_id, call_order_id, title, funding, completed, planned, risks, issues, travel, staffing, drafted)
       values ($1,$2,null,$3,$4,$5,$6,$7,'N/A',null,true)`,
      [id, c.id, JSON.stringify(funding), JSON.stringify(pull(WEEKLY_SECTIONS.accomplishments)), JSON.stringify(pull(WEEKLY_SECTIONS.planned)),
       JSON.stringify(flat(WEEKLY_SECTIONS.risks)), JSON.stringify(flat(WEEKLY_SECTIONS.issues))],
    );
  }
  await audit(db, req, "monthly_report.create", "monthly_report", id, { period, mode, sections: orders.length });
}));

app.post("/api/monthly-reports/upload", requirePm, upload.array("files"), mutation(async (db, req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) { res.status(400).json({ error: "No files were uploaded." }); return false; }
  const period = String(req.body?.period || "").trim() || monthLabel();
  for (const f of files) {
    const id = await insertMonthly(db, period, f.originalname, "Uploaded", `/uploads/${f.filename}`);
    await audit(db, req, "monthly_report.upload", "monthly_report", id, { period, file: f.originalname });
  }
}));

app.put("/api/monthly-reports/:id/sections/:callOrderId", requirePm, mutation(async (db, req, res) => {
  const { rows: reps } = await db.query("select * from monthly_reports where id = $1", [req.params.id]);
  if (!reps[0]) { res.status(404).json({ error: "Monthly report not found." }); return false; }
  const c = await callOrderOr404(db, req.params.callOrderId as string, res);
  if (!c) return false;
  const body = (req.body || {}) as Partial<MsrSectionInput>;
  const entries = (v: unknown) => Array.isArray(v)
    ? v.map((e) => ({ title: String((e as { title?: unknown })?.title ?? "").trim(), text: String((e as { text?: unknown })?.text ?? "").trim() })).filter((e) => e.text)
    : [];
  const funding = [
    { label: "Funds Obligated", value: num(body.obligated) }, { label: "Funds Expended to Date", value: num(body.expended) },
    { label: "Funds Remaining", value: num(body.remaining) }, { label: "Estimate at Completion", value: num(body.eac) },
    { label: "Over/Under", value: num(body.over) },
  ];
  const title = `${c.id} — ${c.name}`;
  const { rows } = await db.query<{ id: number; existed: boolean }>(
    `insert into msr_sections (monthly_report_id, call_order_id, title, funding, completed, planned, risks, issues, travel, drafted)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,false)
     on conflict (monthly_report_id, call_order_id) do update set
       title = excluded.title, funding = excluded.funding, completed = excluded.completed, planned = excluded.planned,
       risks = excluded.risks, issues = excluded.issues, travel = excluded.travel, drafted = false, updated_at = now()
     returning id, (xmax <> 0) as existed`,
    [reps[0].id, c.id, title, JSON.stringify(funding), JSON.stringify(entries(body.completed)), JSON.stringify(entries(body.planned)),
     JSON.stringify(lines(body.risks)), JSON.stringify(lines(body.issues)), String(body.travel || "").trim() || "N/A"],
  );
  await audit(db, req, rows[0].existed ? "msr_section.edit" : "msr_section.add", "msr_section", rows[0].id, { monthlyReportId: reps[0].id, callOrderId: c.id });
}));

// ---- Static client (production) ----------------------------------------------------------------

const dist = join(root, "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => res.sendFile(join(dist, "index.html")));
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const e = err as { status?: number; message?: string };
  const status = e?.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "The portal could not complete the request." : e.message });
});

const port = Number(process.env.PORT) || 3001;
migrate()
  .then(() => app.listen(port, () => console.log(`API listening on http://localhost:${port}`)))
  .catch((err) => { console.error("Could not apply schema:", err); process.exit(1); });

