import express from "express";
import { authenticateRequest, requirePm } from "../auth-middleware.ts";
import { audit, mutation, str, callOrderIdParam, requireScopedCallOrderAccess } from "../route-helpers.ts";

const router = express.Router({ mergeParams: true });
router.use(authenticateRequest, requirePm, requireScopedCallOrderAccess);

router.post("/", mutation(async (db, req, res) => {
  const callOrderId = callOrderIdParam(req);
  const name = str(req.body?.name);
  if (!name) { res.status(400).json({ error: "A name is required." }); return false; }
  const weeklyReportId = req.body?.weeklyReportId ? Number(req.body.weeklyReportId) : null;
  const { rows } = await db.query<{ id: number }>(
    `insert into action_items (weekly_report_id, call_order_id, name, description, date_assigned)
     values ($1,$2,$3,$4, coalesce($5, current_date)) returning id`,
    [weeklyReportId, callOrderId, name, str(req.body?.description), str(req.body?.dateAssigned)],
  );
  await audit(db, req, "action_item.create", "action_item", rows[0].id, { callOrderId, name });
}));

router.patch("/:actionItemId", mutation(async (db, req, res) => {
  const { rows } = await db.query("select * from action_items where id = $1", [req.params.actionItemId]);
  const a = rows[0];
  if (!a) { res.status(404).json({ error: "Action item not found." }); return false; }
  const status = str(req.body?.status);
  if (status && !["open", "closed"].includes(status)) { res.status(400).json({ error: "Invalid status." }); return false; }
  const closedAt = status === "closed" && a.status !== "closed" ? new Date() : status === "open" ? null : a.closed_at;
  await db.query(
    `update action_items set name = $2, description = $3, status = coalesce($4, status), closed_at = $5 where id = $1`,
    [a.id, str(req.body?.name) ?? a.name, str(req.body?.description) ?? a.description, status, closedAt],
  );
  await audit(db, req, "action_item.update", "action_item", a.id, { status });
}));

router.delete("/:actionItemId", mutation(async (db, req, res) => {
  const { rows } = await db.query("delete from action_items where id = $1 returning *", [req.params.actionItemId]);
  if (!rows[0]) { res.status(404).json({ error: "Action item not found." }); return false; }
  await audit(db, req, "action_item.delete", "action_item", rows[0].id, {});
}));

export default router;

/** Unscoped search across closed action items older than 1 week, for the archive view. Mounted separately in index.ts. */
export const archiveRouter = express.Router();
archiveRouter.use(authenticateRequest);
archiveRouter.get("/", async (req, res, next) => {
  try {
    const { pool } = await import("../db.ts");
    const { getAccessibleCallOrders } = await import("../auth-middleware.ts");
    const accessible = await getAccessibleCallOrders(pool, req.user!.id, req.user!.role);
    const q = str(req.query.q as string) || "";
    const { rows } = await pool.query(
      `select a.*, co.name as call_order_name from action_items a
       left join call_orders co on co.id = a.call_order_id
       where a.status = 'closed' and a.closed_at < now() - interval '7 days'
         and ($1::text[] is null or a.call_order_id = ANY($1))
         and ($2 = '' or a.name ilike '%' || $2 || '%' or a.description ilike '%' || $2 || '%')
       order by a.closed_at desc limit 200`,
      [accessible, q],
    );
    res.json(rows);
  } catch (err) { next(err); }
});
