import express from "express";
import { authenticateRequest, requirePm } from "../auth-middleware.ts";
import { audit, mutation, num, str, callOrderIdParam, requireScopedCallOrderAccess } from "../route-helpers.ts";

const router = express.Router({ mergeParams: true });
router.use(authenticateRequest, requirePm, requireScopedCallOrderAccess);

// POST /api/scope/:callOrderId/clins
router.post("/", mutation(async (db, req, res) => {
  const callOrderId = callOrderIdParam(req);
  const name = str(req.body?.name);
  if (!name) { res.status(400).json({ error: "A CLIN name is required." }); return false; }
  const fundedAmount = num(req.body?.fundedAmount) ?? 0;
  const { rows } = await db.query<{ id: number }>(
    `insert into clins (call_order_id, name, funded_amount, sort_order)
     values ($1,$2,$3, coalesce((select max(sort_order) + 1 from clins where call_order_id is not distinct from $1), 0)) returning id`,
    [callOrderId, name, fundedAmount],
  );
  await audit(db, req, "clin.create", "clin", rows[0].id, { callOrderId, name, fundedAmount });
}));

// PATCH /api/scope/:callOrderId/clins/:clinId
router.patch("/:clinId", mutation(async (db, req, res) => {
  const { rows } = await db.query("select * from clins where id = $1", [String(req.params.clinId)]);
  const clin = rows[0];
  if (!clin) { res.status(404).json({ error: "CLIN not found." }); return false; }
  const name = str(req.body?.name) ?? clin.name;
  const fundedAmount = req.body?.fundedAmount !== undefined ? (num(req.body.fundedAmount) ?? clin.funded_amount) : clin.funded_amount;
  await db.query("update clins set name = $2, funded_amount = $3 where id = $1", [clin.id, name, fundedAmount]);
  await audit(db, req, "clin.update", "clin", clin.id, { name, fundedAmount });
}));

// DELETE /api/scope/:callOrderId/clins/:clinId
router.delete("/:clinId", mutation(async (db, req, res) => {
  const { rows } = await db.query("delete from clins where id = $1 returning *", [String(req.params.clinId)]);
  if (!rows[0]) { res.status(404).json({ error: "CLIN not found." }); return false; }
  await audit(db, req, "clin.delete", "clin", rows[0].id, { name: rows[0].name });
}));

// PUT /api/scope/:callOrderId/clins/:clinId/monthly-spend/:month  (month = YYYY-MM-01)
router.put("/:clinId/monthly-spend/:month", mutation(async (db, req, res) => {
  const clinId = String(req.params.clinId);
  const month = String(req.params.month);
  const { rows } = await db.query("select id from clins where id = $1", [clinId]);
  if (!rows[0]) { res.status(404).json({ error: "CLIN not found." }); return false; }
  const projectedAmount = num(req.body?.projectedAmount);
  const actualAmount = num(req.body?.actualAmount);
  await db.query(
    `insert into clin_monthly_spend (clin_id, month, projected_amount, actual_amount)
     values ($1,$2,$3,$4)
     on conflict (clin_id, month) do update set projected_amount = excluded.projected_amount, actual_amount = excluded.actual_amount`,
    [clinId, month, projectedAmount, actualAmount],
  );
  await audit(db, req, "clin.monthly_spend", "clin", clinId, { month, projectedAmount, actualAmount });
}));

export default router;
