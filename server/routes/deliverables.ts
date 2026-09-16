import express from "express";
import { authenticateRequest, requirePm } from "../auth-middleware.ts";
import { audit, mutation, str, callOrderIdParam, requireScopedCallOrderAccess } from "../route-helpers.ts";
import { upload } from "../uploads.ts";

const router = express.Router({ mergeParams: true });
router.use(authenticateRequest, requirePm, requireScopedCallOrderAccess);

router.post("/", upload.single("file"), mutation(async (db, req, res) => {
  const callOrderId = callOrderIdParam(req);
  const name = str(req.body?.name);
  const linkType = str(req.body?.linkType);
  if (!name || (linkType !== "file" && linkType !== "url")) {
    res.status(400).json({ error: "A name and link type (file or url) are required." });
    return false;
  }
  const file = req.file as Express.Multer.File | undefined;
  const url = str(req.body?.url);
  if (linkType === "file" && !file) { res.status(400).json({ error: "A file is required for link type 'file'." }); return false; }
  if (linkType === "url" && !url) { res.status(400).json({ error: "A URL is required for link type 'url'." }); return false; }
  const { rows } = await db.query<{ id: number }>(
    `insert into deliverables (call_order_id, name, category, period_label, link_type, file_href, url, due_date, delivery_date, status, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending', coalesce((select max(sort_order) + 1 from deliverables where call_order_id is not distinct from $1), 0)) returning id`,
    [callOrderId, name, str(req.body?.category), str(req.body?.periodLabel), linkType, file ? `/uploads/${file.filename}` : null,
     linkType === "url" ? url : null, str(req.body?.dueDate), str(req.body?.deliveryDate)],
  );
  await audit(db, req, "deliverable.create", "deliverable", rows[0].id, { callOrderId, name });
}));

router.patch("/:deliverableId", mutation(async (db, req, res) => {
  const { rows } = await db.query("select * from deliverables where id = $1", [req.params.deliverableId]);
  const d = rows[0];
  if (!d) { res.status(404).json({ error: "Deliverable not found." }); return false; }
  const status = str(req.body?.status);
  if (status && !["pending", "delivered", "accepted"].includes(status)) {
    res.status(400).json({ error: "Invalid status." });
    return false;
  }
  await db.query(
    `update deliverables set name = $2, category = $3, period_label = $4, due_date = $5, delivery_date = $6, status = coalesce($7, status) where id = $1`,
    [d.id, str(req.body?.name) ?? d.name, str(req.body?.category) ?? d.category, str(req.body?.periodLabel) ?? d.period_label,
     str(req.body?.dueDate) ?? d.due_date, str(req.body?.deliveryDate) ?? d.delivery_date, status],
  );
  await audit(db, req, "deliverable.update", "deliverable", d.id, { name: d.name, status });
}));

router.delete("/:deliverableId", mutation(async (db, req, res) => {
  const { rows } = await db.query("delete from deliverables where id = $1 returning *", [req.params.deliverableId]);
  if (!rows[0]) { res.status(404).json({ error: "Deliverable not found." }); return false; }
  await audit(db, req, "deliverable.delete", "deliverable", rows[0].id, { name: rows[0].name });
}));

export default router;
