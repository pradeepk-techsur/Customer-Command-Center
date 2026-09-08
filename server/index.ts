import express from "express";
import cors from "cors";
import multer from "multer";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { pool, withTransaction } from "./db.ts";
import { migrate } from "./migrate.ts";
import { actorOf, requirePm } from "./auth.ts";
import { authenticateRequest, requireCallOrderAccess, getAccessibleCallOrders, requireProgramManager } from "./auth-middleware.ts";
import { buildSnapshot } from "./snapshot.ts";
import { dayLabel, firstOfMonth, monthLabel, toIsoDate } from "./dates.ts";
import type { MsrSectionInput, WeeklyReportInput } from "../shared/types.ts";
import { WEEKLY_SECTIONS } from "../shared/types.ts";
import type pg from "pg";
import authRouter from "./routes/auth.ts";
import adminRouter from "./routes/admin.ts";

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

// Mount authentication routes (no auth required for login/register)
app.use("/api/auth", authRouter);

// Mount admin routes (requires admin role)
app.use("/api/admin", adminRouter);

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
        // Pass user info for access filtering
        return buildSnapshot(db, req.user?.id, req.user?.role);
      });
      if (snapshot) res.json(snapshot);
    } catch (err) { next(err); }
  };
}

app.get("/api/health", async (_req, res, next) => {
  try { await pool.query("select 1"); res.json({ ok: true }); } catch (err) { next(err); }
});

app.get("/api/portal", authenticateRequest, async (req, res, next) => {
  try {
    const snapshot = await buildSnapshot(pool, req.user!.id, req.user!.role);
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
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

app.patch("/api/call-orders/:id/spend", authenticateRequest, requirePm, requireCallOrderAccess, mutation(async (db, req, res) => {
  const c = await callOrderOr404(db, req.params.id as string, res);
  if (!c) return false;
  const spend = num(req.body?.spend);
  if (spend === null || spend < 0) { res.status(400).json({ error: "Funds expended must be a non-negative amount." }); return false; }
  await db.query("update call_orders set spend = $2, fin_updated_on = current_date where id = $1", [c.id, spend]);
  await audit(db, req, "call_order.spend", "call_order", c.id, { from: c.spend, to: spend });
}));

// ---- Staff -------------------------------------------------------------------------------------

app.post("/api/call-orders/:id/staff", authenticateRequest, requirePm, requireCallOrderAccess, mutation(async (db, req, res) => {
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

app.patch("/api/staff/:id", authenticateRequest, requirePm, async (req, res, next) => {
  // Load staff record to check call order access
  const { rows } = await pool.query("select * from staff where id = $1", [req.params.id]);
  const staff = rows[0];
  if (!staff) {
    res.status(404).json({ error: "Staff record not found." });
    return;
  }
  // Check access to the call order
  const hasAccess = await hasCallOrderAccess(pool, req.user!.id, req.user!.role, staff.call_order_id);
  if (!hasAccess) {
    res.status(403).json({ error: "Access denied", message: "You do not have permission to access this call order" });
    return;
  }
  next();
}, mutation(async (db, req, res) => {
  const { rows } = await db.query("select * from staff where id = $1", [req.params.id]);
  const s = rows[0];
  if (!s) { res.status(404).json({ error: "Staff record not found." }); return false; }
  const status = String(req.body?.status || "").trim();
  if (!status) { res.status(400).json({ error: "A status is required." }); return false; }
  await db.query("update staff set status = $2 where id = $1", [s.id, status]);
  await db.query("update call_orders set people_updated_on = current_date where id = $1", [s.call_order_id]);
  await audit(db, req, "staff.status", "staff", s.id, { callOrderId: s.call_order_id, name: s.name, from: s.status, to: status });
}));

app.delete("/api/staff/:id", authenticateRequest, requirePm, async (req, res, next) => {
  // Load staff record to check call order access
  const { rows } = await pool.query("select * from staff where id = $1", [req.params.id]);
  const staff = rows[0];
  if (!staff) {
    res.status(404).json({ error: "Staff record not found." });
    return;
  }
  // Check access to the call order
  const hasAccess = await hasCallOrderAccess(pool, req.user!.id, req.user!.role, staff.call_order_id);
  if (!hasAccess) {
    res.status(403).json({ error: "Access denied", message: "You do not have permission to access this call order" });
    return;
  }
  next();
}, mutation(async (db, req, res) => {
  const { rows } = await db.query("delete from staff where id = $1 returning *", [req.params.id]);
  const s = rows[0];
  if (!s) { res.status(404).json({ error: "Staff record not found." }); return false; }
  await db.query("update call_orders set people_updated_on = current_date where id = $1", [s.call_order_id]);
  await audit(db, req, "staff.remove", "staff", s.id, { callOrderId: s.call_order_id, name: s.name, laborCategory: s.labor_category, status: s.status });
}));

// ---- Weekly status reports ---------------------------------------------------------------------

app.post("/api/call-orders/:id/weekly-reports", authenticateRequest, requirePm, requireCallOrderAccess, mutation(async (db, req, res) => {
  const c = await callOrderOr404(db, req.params.id as string, res);
  if (!c) return false;
  const body = (req.body || {}) as Partial<WeeklyReportInput>;
  const weekLabel = String(body.weekEnding || "").trim() || dayLabel();
  const submittedBy = String(body.submittedBy || "").trim() || "Project Manager";
  const { rows } = await db.query<{ id: number }>(
    `insert into weekly_reports (call_order_id, week_ending, week_label, file_name, submitted_by, status, href, created_in_portal, created_by_user_id, status_v2)
     values ($1,$2,$3,'Weekly Status Report (created in portal)',$4,'Submitted',null,true,$5,'draft') returning id`,
    [c.id, toIsoDate(weekLabel), weekLabel, submittedBy, req.user!.id],
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

// Get a single weekly report with its items
app.get("/api/call-orders/:id/weekly-reports/:reportId", authenticateRequest, requirePm, requireCallOrderAccess, async (req, res, next) => {
  try {
    const c = await callOrderOr404(pool, req.params.id as string, res);
    if (!c) return;
    const reportId = parseInt(req.params.reportId as string, 10);
    
    // Get report header
    const { rows: reports } = await pool.query(
      `select * from weekly_reports where id = $1 and call_order_id = $2`,
      [reportId, c.id]
    );
    if (!reports.length) {
      res.status(404).json({ error: "Weekly report not found" });
      return;
    }
    
    const report = reports[0];
    
    // Get report items
    const { rows: items } = await pool.query(
      `select * from weekly_report_items where weekly_report_id = $1 order by sort_order`,
      [reportId]
    );
    
    // Group items by section
    const groups: { label: string; items: string[] }[] = [];
    for (const item of items) {
      let group = groups.find(g => g.label === item.section_label);
      if (!group) {
        group = { label: item.section_label, items: [] };
        groups.push(group);
      }
      group.items.push(item.item_text);
    }
    
    res.json({
      id: report.id,
      callOrderId: report.call_order_id,
      weekEnding: report.week_ending,
      weekLabel: report.week_label,
      submittedBy: report.submitted_by,
      status: report.status,
      statusV2: report.status_v2 || 'draft',
      fileName: report.file_name,
      href: report.href,
      createdByUserId: report.created_by_user_id,
      submittedAt: report.submitted_at,
      lastEditedAt: report.last_edited_at,
      groups,
    });
  } catch (err) {
    next(err);
  }
});

// Edit existing weekly report
app.put("/api/call-orders/:id/weekly-reports/:reportId", authenticateRequest, requirePm, requireCallOrderAccess, mutation(async (db, req, res) => {
  const c = await callOrderOr404(db, req.params.id as string, res);
  if (!c) return false;
  const reportId = parseInt(req.params.reportId as string, 10);
  
  // Check if report exists and belongs to this call order
  const { rows: reports } = await db.query(
    `select id, status_v2, created_by_user_id from weekly_reports where id = $1 and call_order_id = $2`,
    [reportId, c.id]
  );
  if (!reports.length) {
    res.status(404).json({ error: "Weekly report not found" });
    return false;
  }
  
  const report = reports[0];
  
  // Check ownership: must be creator OR admin/program_manager
  const isOwner = report.created_by_user_id === req.user!.id;
  const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'program_manager';
  if (!isOwner && !isPrivileged) {
    res.status(403).json({ error: "You can only edit your own reports" });
    return false;
  }
  
  // Project Managers can edit their own reports anytime (draft or submitted)
  // No status restrictions for editing
  
  const body = (req.body || {}) as Partial<WeeklyReportInput>;
  const weekLabel = String(body.weekEnding || "").trim() || dayLabel();
  const submittedBy = String(body.submittedBy || "").trim() || "Project Manager";
  
  // Update report header
  await db.query(
    `update weekly_reports 
     set week_ending = $1, week_label = $2, submitted_by = $3, last_edited_at = now()
     where id = $4`,
    [toIsoDate(weekLabel), weekLabel, submittedBy, reportId]
  );
  
  // Delete existing items
  await db.query("delete from weekly_report_items where weekly_report_id = $1", [reportId]);
  
  // Re-insert items
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
  
  await audit(db, req, "weekly_report.edit", "weekly_report", reportId, { callOrderId: c.id, weekEnding: weekLabel });
}));

app.post("/api/call-orders/:id/weekly-reports/upload", authenticateRequest, requirePm, requireCallOrderAccess, upload.array("files"), mutation(async (db, req, res) => {
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

// Submit weekly report (change status from draft to submitted)
app.post("/api/call-orders/:id/weekly-reports/:reportId/submit", authenticateRequest, requirePm, requireCallOrderAccess, mutation(async (db, req, res) => {
  const c = await callOrderOr404(db, req.params.id as string, res);
  if (!c) return false;
  const reportId = parseInt(req.params.reportId as string, 10);
  
  // Check if report exists and belongs to this call order
  const { rows: reports } = await db.query(
    `select id, status_v2, created_by_user_id from weekly_reports where id = $1 and call_order_id = $2`,
    [reportId, c.id]
  );
  if (!reports.length) {
    res.status(404).json({ error: "Weekly report not found" });
    return false;
  }
  
  const report = reports[0];
  
  // Check ownership: must be creator OR admin/program_manager
  const isOwner = report.created_by_user_id === req.user!.id;
  const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'program_manager';
  if (!isOwner && !isPrivileged) {
    res.status(403).json({ error: "You can only submit your own reports" });
    return false;
  }
  
  // Check if report is already submitted
  if (report.status_v2 === 'submitted' || report.status_v2 === 'uploaded') {
    res.status(400).json({ error: "Report is already submitted" });
    return false;
  }
  
  // Update status
  await db.query(
    `update weekly_reports 
     set status_v2 = 'submitted', submitted_at = now(), last_edited_at = now()
     where id = $1`,
    [reportId]
  );
  
  await audit(db, req, "weekly_report.submit", "weekly_report", reportId, { callOrderId: c.id });
}));

// ---- Consolidated Weekly Reports (Program Manager View) ---------------------------------------

import { getPastSundays, toIsoDateString, toWeekLabel } from "./weekly-utils.ts";

// Get available week ending dates (Sundays) for dropdown
app.get("/api/weekly-reports/weeks", authenticateRequest, async (req, res, next) => {
  try {
    const sundays = getPastSundays(12); // Past 12 weeks
    const weeks = sundays.map(date => ({
      value: toIsoDateString(date),
      label: toWeekLabel(date),
    }));
    res.json({ weeks });
  } catch (err) {
    next(err);
  }
});

// Get consolidated view of all call order reports for a specific week (Program Manager)
app.get("/api/weekly-reports/consolidated/:weekEnding", authenticateRequest, requireProgramManager, async (req, res, next) => {
  try {
    const weekEnding = req.params.weekEnding;
    const client = await pool.connect();
    
    try {
      // Get or create consolidated report entry
      let { rows: consolidated } = await client.query(
        `select * from consolidated_weekly_reports where week_ending = $1`,
        [weekEnding]
      );
      
      if (!consolidated.length) {
        // Create new consolidated report
        const { rows: newConsolidated } = await client.query(
          `insert into consolidated_weekly_reports (week_ending, week_label, status, created_by, customer_visible)
           values ($1, $2, 'draft', $3, false) returning *`,
          [weekEnding, toWeekLabel(new Date(weekEnding)), req.user!.id]
        );
        consolidated = newConsolidated;
      }
      
      // Get all call orders
      const { rows: callOrders } = await client.query(
        `select id, name, pm from call_orders where not pending order by sort_order`
      );
      
      // Get reports for this week
      const { rows: reports } = await client.query(
        `select id, call_order_id, status_v2, submitted_by, submitted_at, created_by_user_id
         from weekly_reports
         where week_ending = $1`,
        [weekEnding]
      );
      
      // Build response
      const callOrderReports = callOrders.map(co => {
        // Get all reports for this call order
        const coReports = reports.filter(r => r.call_order_id === co.id);
        
        // Prioritize: submitted > uploaded > draft
        // If multiple submitted, take the most recent
        let report = null;
        if (coReports.length > 0) {
          const submitted = coReports.filter(r => r.status_v2 === 'submitted').sort((a, b) => {
            const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
            const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
            return bTime - aTime; // Most recent first
          });
          const uploaded = coReports.filter(r => r.status_v2 === 'uploaded');
          const drafts = coReports.filter(r => r.status_v2 === 'draft');
          
          report = submitted[0] || uploaded[0] || drafts[0];
        }
        
        return {
          callOrderId: co.id,
          callOrderName: co.name,
          pm: co.pm,
          hasReport: !!report,
          reportId: report?.id || null,
          reportStatus: report?.status_v2 || null,
          submittedBy: report?.submitted_by || null,
          submittedAt: report?.submitted_at || null,
        };
      });
      
      res.json({
        ...consolidated[0],
        weekEnding: consolidated[0].week_ending,
        weekLabel: consolidated[0].week_label,
        customerVisible: consolidated[0].customer_visible,
        customerReleasedAt: consolidated[0].customer_released_at,
        customerReleasedBy: consolidated[0].customer_released_by,
        createdBy: consolidated[0].created_by,
        createdAt: consolidated[0].created_at,
        updatedAt: consolidated[0].updated_at,
        callOrderReports,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// Submit consolidated weekly report to customers (Program Manager only)
app.post("/api/weekly-reports/consolidated/:weekEnding/submit", authenticateRequest, requireProgramManager, mutation(async (db, req, res) => {
  const weekEnding = req.params.weekEnding;
  
  // Check if consolidated report exists
  const { rows: consolidated } = await db.query(
    `select id from consolidated_weekly_reports where week_ending = $1`,
    [weekEnding]
  );
  
  if (!consolidated.length) {
    res.status(404).json({ error: "Consolidated weekly report not found" });
    return false;
  }
  
  // Update consolidated report status
  await db.query(
    `update consolidated_weekly_reports
     set status = 'submitted',
         customer_visible = true,
         customer_released_at = now(),
         customer_released_by = $2,
         updated_at = now()
     where week_ending = $1`,
    [weekEnding, req.user!.id]
  );
  
  await audit(db, req, "consolidated_weekly_report.submit", "consolidated_weekly_report", consolidated[0].id, { weekEnding });
}));

// Get customer-visible weekly reports (for customers)
app.get("/api/weekly-reports/customer", authenticateRequest, async (req, res, next) => {
  try {
    const client = await pool.connect();
    
    try {
      // Get all submitted consolidated reports
      const { rows: consolidated } = await client.query(
        `select * from consolidated_weekly_reports
         where customer_visible = true
         order by week_ending desc`
      );
      
      // For each consolidated report, get the call orders the customer has access to
      const result = [];
      for (const cr of consolidated) {
        // Get call orders accessible to this user
        const accessibleCallOrders = await getAccessibleCallOrders(client, req.user!.id, req.user!.role);
        
        // Get reports for this week and accessible call orders
        // If accessibleCallOrders is null, user has access to all call orders
        const { rows: reports } = accessibleCallOrders === null
          ? await client.query(
              `select wr.*, co.name as call_order_name
               from weekly_reports wr
               join call_orders co on co.id = wr.call_order_id
               where wr.week_ending = $1
                 and wr.status_v2 = 'submitted'
               order by co.sort_order`,
              [cr.week_ending]
            )
          : await client.query(
              `select wr.*, co.name as call_order_name
               from weekly_reports wr
               join call_orders co on co.id = wr.call_order_id
               where wr.week_ending = $1
                 and wr.call_order_id = any($2::text[])
                 and wr.status_v2 = 'submitted'
               order by co.sort_order`,
              [cr.week_ending, accessibleCallOrders]
            );
        
        if (reports.length > 0) {
          result.push({
            ...cr,
            weekEnding: cr.week_ending,
            weekLabel: cr.week_label,
            reports: reports.map(r => ({
              id: r.id,
              callOrderId: r.call_order_id,
              callOrderName: r.call_order_name,
              weekLabel: r.week_label,
              submittedBy: r.submitted_by,
              submittedAt: r.submitted_at,
            })),
          });
        }
      }
      
      res.json({ weeklyReports: result });
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ---- Monthly status reports --------------------------------------------------------------------

async function insertMonthly(
  db: Db, 
  period: string, 
  file: string, 
  status: string, 
  href: string | null,
  reportType: 'program' | 'pm' = 'program',
  createdByUserId: number | null = null,
  parentReportId: number | null = null
) {
  const { rows } = await db.query<{ id: number }>(
    `insert into monthly_reports (period, period_start, file_name, submitted_by, due_on, status, href, report_type, created_by_user_id, parent_report_id)
     values ($1,$2,$3,'Program Office',null,$4,$5,$6,$7,$8) returning id`,
    [period, firstOfMonth(period), file, status, href, reportType, createdByUserId, parentReportId],
  );
  return rows[0].id;
}

app.post("/api/monthly-reports", authenticateRequest, requireProgramManager, mutation(async (db, req) => {
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

app.post("/api/monthly-reports/upload", authenticateRequest, requireProgramManager, upload.array("files"), mutation(async (db, req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) { res.status(400).json({ error: "No files were uploaded." }); return false; }
  const period = String(req.body?.period || "").trim() || monthLabel();
  for (const f of files) {
    const id = await insertMonthly(db, period, f.originalname, "Uploaded", `/uploads/${f.filename}`);
    await audit(db, req, "monthly_report.upload", "monthly_report", id, { period, file: f.originalname });
  }
}));

// Submit monthly report for customer review
app.post("/api/monthly-reports/:id/submit", authenticateRequest, requireProgramManager, mutation(async (db, req) => {
  const reportId = parseInt(req.params.id, 10);
  if (isNaN(reportId)) throw new Error("Invalid report ID");
  
  // Update report status to "Submitted to Customer" and make visible to customers
  await db.query(
    `update monthly_reports 
     set status = 'Submitted to Customer',
         customer_visible = true,
         customer_released_at = now(),
         customer_released_by = $2
     where id = $1`,
    [reportId, req.user!.id]
  );
  
  await audit(db, req, "monthly_report.submit", "monthly_report", reportId, { status: "Submitted to Customer", customer_visible: true });
}));

// PM monthly reports - PMs create their own monthly reports
app.post("/api/pm/monthly-reports", authenticateRequest, requirePm, mutation(async (db, req) => {
  const period = String(req.body?.period || "").trim() || monthLabel();
  const mode = req.body?.mode === "draft" ? "draft" : "blank";
  const userId = req.user!.id;
  const userName = req.user!.email.split('@')[0].replace(/[._]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  // Check if PM already has a report for this period
  const { rows: existing } = await db.query(
    `select id from monthly_reports where created_by_user_id = $1 and period = $2 and report_type = 'pm'`,
    [userId, period]
  );
  
  if (existing.length > 0) {
    // Return existing report ID
    await audit(db, req, "monthly_report.existing", "monthly_report", existing[0].id, { period, mode });
    return;
  }
  
  if (mode === "blank") {
    const id = await insertMonthly(db, period, `${userName} - MSR ${period}`, "Draft", null, 'pm', userId, null);
    await audit(db, req, "monthly_report.create", "monthly_report", id, { period, mode, reportType: 'pm' });
    return;
  }

  // Draft from portal data: Get accessible call orders and their weekly reports
  const accessibleCallOrders = await getAccessibleCallOrders(db, userId, req.user!.role);
  const id = await insertMonthly(db, period, `${userName} - MSR ${period} (drafted)`, "Draft", null, 'pm', userId, null);
  const start = firstOfMonth(period);
  const end = start ? (() => { const d = new Date(start + "T00:00:00"); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); })() : null;
  
  // Get call orders the PM has access to
  const callOrderIds = accessibleCallOrders || [];
  if (!callOrderIds.length) {
    // No call orders accessible, create empty report
    await audit(db, req, "monthly_report.create", "monthly_report", id, { period, mode, reportType: 'pm', sections: 0 });
    return;
  }
  
  const { rows: orders } = await db.query(
    "select * from call_orders where not pending and id = ANY($1) order by sort_order",
    [callOrderIds]
  );
  const { rows: weeklies } = await db.query(
    `select r.*, i.section_label, i.item_text, i.sort_order as item_order
       from weekly_reports r join weekly_report_items i on i.weekly_report_id = r.id
      where r.created_in_portal and r.call_order_id = ANY($1)
        and ($2::date is null or r.week_ending is null or (r.week_ending >= $2 and r.week_ending < $3))
      order by r.week_ending, r.id, i.sort_order`,
    [callOrderIds, start, end],
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
  await audit(db, req, "monthly_report.create", "monthly_report", id, { period, mode, reportType: 'pm', sections: orders.length });
}));

// Get PM submission status for a period
app.get("/api/program-manager/submission-status/:period", authenticateRequest, requireProgramManager, async (req, res) => {
  const period = req.params.period;
  
  try {
    // Get all PMs (users with role 'pm')
    const { rows: pms } = await pool.query(
      `select id, email, name from users where role = 'pm' order by name, email`
    );
    
    // Get PM monthly reports for this period
    const { rows: reports } = await pool.query(
      `select id, created_by_user_id, status, created_at 
       from monthly_reports 
       where period = $1 and report_type = 'pm'`,
      [period]
    );
    
    // Build submission status for each PM
    const submissions = pms.map(pm => {
      const report = reports.find(r => r.created_by_user_id === pm.id);
      return {
        userId: pm.id,
        userName: pm.name || pm.email,
        email: pm.email,
        hasSubmitted: !!report,
        reportId: report?.id || null,
        status: report?.status || null,
        submittedAt: report?.created_at || null,
      };
    });
    
    res.json({ period, submissions });
  } catch (error) {
    console.error("Error fetching PM submission status:", error);
    res.status(500).json({ error: "Failed to fetch submission status" });
  }
});

// Consolidate PM reports into master program report
app.post("/api/program-manager/consolidate", authenticateRequest, requireProgramManager, mutation(async (db, req, res) => {
  const { period, pmReportIds } = req.body as { period: string; pmReportIds: number[] };
  
  if (!period || !Array.isArray(pmReportIds) || pmReportIds.length === 0) {
    res.status(400).json({ error: "Invalid request: period and pmReportIds required" });
    return false;
  }
  
  // Create the consolidated program report
  const consolidatedId = await insertMonthly(
    db,
    period,
    `MSR ${period} (Consolidated from ${pmReportIds.length} PM reports)`,
    "Draft",
    null,
    'program',
    req.user!.id,
    null
  );
  
  // Get all sections from the PM reports
  const { rows: pmSections } = await db.query(
    `select s.*, r.created_by_user_id 
     from msr_sections s 
     join monthly_reports r on r.id = s.monthly_report_id 
     where s.monthly_report_id = ANY($1)
     order by r.created_at desc, s.call_order_id`,
    [pmReportIds]
  );
  
  // Group sections by call order ID (most recent first due to ORDER BY)
  const sectionsByCallOrder = new Map<string, typeof pmSections[0]>();
  for (const section of pmSections) {
    if (!sectionsByCallOrder.has(section.call_order_id)) {
      sectionsByCallOrder.set(section.call_order_id, section);
    }
  }
  
  // Insert consolidated sections
  for (const [callOrderId, section] of sectionsByCallOrder.entries()) {
    await db.query(
      `insert into msr_sections (monthly_report_id, call_order_id, title, funding, completed, planned, risks, issues, travel, staffing, drafted)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)`,
      [
        consolidatedId,
        callOrderId,
        section.title,
        section.funding,
        section.completed,
        section.planned,
        section.risks,
        section.issues,
        section.travel,
        section.staffing
      ]
    );
  }
  
  // Link PM reports to the consolidated report
  await db.query(
    `update monthly_reports set parent_report_id = $1 where id = ANY($2)`,
    [consolidatedId, pmReportIds]
  );
  
  await audit(db, req, "monthly_report.consolidate", "monthly_report", consolidatedId, { 
    period, 
    pmReportCount: pmReportIds.length,
    sectionCount: sectionsByCallOrder.size 
  });
  
  res.json({ consolidatedReportId: consolidatedId, sectionsConsolidated: sectionsByCallOrder.size });
  return true;
}));

app.put("/api/monthly-reports/:id/sections/:callOrderId", authenticateRequest, requirePm, async (req, res, next) => {
  // Check access to the call order (params.callOrderId)
  const callOrderId = req.params.callOrderId;
  if (!callOrderId) {
    res.status(400).json({ error: "Missing call order ID" });
    return;
  }
  const hasAccess = await hasCallOrderAccess(pool, req.user!.id, req.user!.role, callOrderId);
  if (!hasAccess) {
    res.status(403).json({ error: "Access denied", message: "You do not have permission to access this call order" });
    return;
  }
  next();
}, mutation(async (db, req, res) => {
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

