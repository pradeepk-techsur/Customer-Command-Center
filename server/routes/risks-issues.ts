import express from "express";
import { authenticateRequest, requirePm } from "../auth-middleware.ts";
import { audit, mutation, str, callOrderIdParam, requireScopedCallOrderAccess } from "../route-helpers.ts";

const router = express.Router({ mergeParams: true });
router.use(authenticateRequest, requirePm, requireScopedCallOrderAccess);

const LEVELS = ["low", "medium", "high"];

router.post("/risks", mutation(async (db, req, res) => {
  const callOrderId = callOrderIdParam(req);
  const description = str(req.body?.description);
  const probability = str(req.body?.probability);
  const impact = str(req.body?.impact);
  if (!description || !probability || !impact || !LEVELS.includes(probability) || !LEVELS.includes(impact)) {
    res.status(400).json({ error: "Description, probability, and impact (low/medium/high) are required." });
    return false;
  }
  const { rows } = await db.query<{ id: number }>(
    `insert into risks (call_order_id, description, probability, impact, mitigation)
     values ($1,$2,$3,$4,$5) returning id`,
    [callOrderId, description, probability, impact, str(req.body?.mitigation)],
  );
  await audit(db, req, "risk.create", "risk", rows[0].id, { callOrderId, description });
}));

router.patch("/risks/:riskId", mutation(async (db, req, res) => {
  const { rows } = await db.query("select * from risks where id = $1", [req.params.riskId]);
  const r = rows[0];
  if (!r) { res.status(404).json({ error: "Risk not found." }); return false; }
  const status = str(req.body?.status);
  if (status && !["open", "closed"].includes(status)) { res.status(400).json({ error: "Invalid status." }); return false; }
  const probability = str(req.body?.probability) ?? r.probability;
  const impact = str(req.body?.impact) ?? r.impact;
  if (!LEVELS.includes(probability) || !LEVELS.includes(impact)) { res.status(400).json({ error: "Invalid probability/impact." }); return false; }
  const closedAt = status === "closed" && r.status !== "closed" ? new Date() : status === "open" ? null : r.closed_at;
  await db.query(
    `update risks set description = $2, probability = $3, impact = $4, mitigation = $5, status = coalesce($6, status), closed_at = $7 where id = $1`,
    [r.id, str(req.body?.description) ?? r.description, probability, impact, str(req.body?.mitigation) ?? r.mitigation, status, closedAt],
  );
  await audit(db, req, "risk.update", "risk", r.id, { status });
}));

router.delete("/risks/:riskId", mutation(async (db, req, res) => {
  const { rows } = await db.query("delete from risks where id = $1 returning *", [req.params.riskId]);
  if (!rows[0]) { res.status(404).json({ error: "Risk not found." }); return false; }
  await audit(db, req, "risk.delete", "risk", rows[0].id, {});
}));

router.post("/issues", mutation(async (db, req, res) => {
  const callOrderId = callOrderIdParam(req);
  const description = str(req.body?.description);
  if (!description) { res.status(400).json({ error: "A description is required." }); return false; }
  const { rows } = await db.query<{ id: number }>(
    `insert into issues (call_order_id, description, date_identified, assigned_to)
     values ($1,$2, coalesce($3, current_date), $4) returning id`,
    [callOrderId, description, str(req.body?.dateIdentified), str(req.body?.assignedTo)],
  );
  await audit(db, req, "issue.create", "issue", rows[0].id, { callOrderId, description });
}));

router.patch("/issues/:issueId", mutation(async (db, req, res) => {
  const { rows } = await db.query("select * from issues where id = $1", [req.params.issueId]);
  const i = rows[0];
  if (!i) { res.status(404).json({ error: "Issue not found." }); return false; }
  const status = str(req.body?.status);
  if (status && !["open", "closed"].includes(status)) { res.status(400).json({ error: "Invalid status." }); return false; }
  const closedAt = status === "closed" && i.status !== "closed" ? new Date() : status === "open" ? null : i.closed_at;
  let narrative = i.updates_narrative;
  const note = str(req.body?.appendUpdate);
  if (note) {
    narrative = [...(i.updates_narrative || []), { date: new Date().toISOString().slice(0, 10), text: note }];
  }
  await db.query(
    `update issues set description = $2, assigned_to = $3, status = coalesce($4, status), closed_at = $5, updates_narrative = $6 where id = $1`,
    [i.id, str(req.body?.description) ?? i.description, str(req.body?.assignedTo) ?? i.assigned_to, status, closedAt, JSON.stringify(narrative)],
  );
  await audit(db, req, "issue.update", "issue", i.id, { status });
}));

router.delete("/issues/:issueId", mutation(async (db, req, res) => {
  const { rows } = await db.query("delete from issues where id = $1 returning *", [req.params.issueId]);
  if (!rows[0]) { res.status(404).json({ error: "Issue not found." }); return false; }
  await audit(db, req, "issue.delete", "issue", rows[0].id, {});
}));

export default router;
