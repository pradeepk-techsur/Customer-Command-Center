import express from "express";
import { authenticateRequest, requirePm, hasCallOrderAccess } from "../auth-middleware.ts";
import { pool } from "../db.ts";
import { audit, mutation, str } from "../route-helpers.ts";
import { captureStaffSnapshot } from "../snapshot-history.ts";
import { upload } from "../uploads.ts";

const router = express.Router();
router.use(authenticateRequest, requirePm);

const ONBOARDING_FIELDS: Record<string, string> = {
  offerAcceptedDate: "offer_accepted_date",
  of306SubmittedDate: "of306_submitted_date",
  fingerprintsCompleteDate: "fingerprints_complete_date",
  laptopReceivedDate: "laptop_received_date",
  pivIssuedDate: "piv_issued_date",
  startDate: "start_date",
  endDate: "end_date",
};

async function staffOr404(req: express.Request, res: express.Response) {
  const { rows } = await pool.query("select * from staff where id = $1", [req.params.staffId]);
  const s = rows[0];
  if (!s) { res.status(404).json({ error: "Staff record not found." }); return null; }
  const hasAccess = await hasCallOrderAccess(pool, req.user!.id, req.user!.role, s.call_order_id);
  if (!hasAccess) { res.status(403).json({ error: "Access denied" }); return null; }
  return s;
}

// PATCH /api/staffing/:staffId/contact — contact info + onboarding stage dates
router.patch("/:staffId/contact", mutation(async (db, req, res) => {
  const s = await staffOr404(req, res);
  if (!s) return false;
  const sets: string[] = [];
  const values: unknown[] = [s.id];
  const addColumn = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length}`); };

  if (req.body?.aoEmail !== undefined) addColumn("ao_email", str(req.body.aoEmail));
  if (req.body?.phone !== undefined) addColumn("phone", str(req.body.phone));
  for (const [key, col] of Object.entries(ONBOARDING_FIELDS)) {
    if (req.body?.[key] !== undefined) addColumn(col, str(req.body[key]));
  }
  if (!sets.length) { res.status(400).json({ error: "No fields to update." }); return false; }

  await captureStaffSnapshot(db, s.call_order_id, req.user?.id ?? null, "update", s.id, `Contact/onboarding info updated for ${s.name}`);
  await db.query(`update staff set ${sets.join(", ")} where id = $1`, values);
  await audit(db, req, "staff.contact_update", "staff", s.id, { callOrderId: s.call_order_id, fields: Object.keys(req.body || {}) });
}));

// POST /api/staffing/:staffId/property-return — upload property return document, sets end date if not already set
router.post("/:staffId/property-return", upload.single("file"), mutation(async (db, req, res) => {
  const s = await staffOr404(req, res);
  if (!s) return false;
  const file = req.file as Express.Multer.File | undefined;
  if (!file) { res.status(400).json({ error: "A file is required." }); return false; }
  await captureStaffSnapshot(db, s.call_order_id, req.user?.id ?? null, "update", s.id, `Property return doc uploaded for ${s.name}`);
  await db.query("update staff set property_return_doc_href = $2 where id = $1", [s.id, `/uploads/${file.filename}`]);
  await audit(db, req, "staff.property_return", "staff", s.id, { callOrderId: s.call_order_id });
}));

// ---- Equipment ------------------------------------------------------------------------------

router.post("/:staffId/equipment", mutation(async (db, req, res) => {
  const s = await staffOr404(req, res);
  if (!s) return false;
  const makeModel = str(req.body?.makeModel);
  if (!makeModel) { res.status(400).json({ error: "Make/model is required." }); return false; }
  const { rows } = await db.query<{ id: number }>(
    "insert into staff_equipment (staff_id, make_model, property_tag_number) values ($1,$2,$3) returning id",
    [s.id, makeModel, str(req.body?.propertyTagNumber)],
  );
  await audit(db, req, "staff_equipment.create", "staff_equipment", rows[0].id, { staffId: s.id, makeModel });
}));

router.delete("/equipment/:equipmentId", mutation(async (db, req, res) => {
  const { rows } = await db.query(
    "select e.*, s.call_order_id from staff_equipment e join staff s on s.id = e.staff_id where e.id = $1",
    [req.params.equipmentId],
  );
  const e = rows[0];
  if (!e) { res.status(404).json({ error: "Equipment record not found." }); return false; }
  const hasAccess = await hasCallOrderAccess(pool, req.user!.id, req.user!.role, e.call_order_id);
  if (!hasAccess) { res.status(403).json({ error: "Access denied" }); return false; }
  await db.query("delete from staff_equipment where id = $1", [e.id]);
  await audit(db, req, "staff_equipment.delete", "staff_equipment", e.id, { staffId: e.staff_id });
}));

// ---- Vacancy status (labor_categories) ------------------------------------------------------

router.patch("/labor-categories/:lcatId/vacancy-status", mutation(async (db, req, res) => {
  const { rows } = await db.query("select * from labor_categories where id = $1", [req.params.lcatId]);
  const l = rows[0];
  if (!l) { res.status(404).json({ error: "Labor category not found." }); return false; }
  const hasAccess = await hasCallOrderAccess(pool, req.user!.id, req.user!.role, l.call_order_id);
  if (!hasAccess) { res.status(403).json({ error: "Access denied" }); return false; }
  const vacancyStatus = str(req.body?.vacancyStatus);
  if (vacancyStatus && !["sourcing", "on_hold", "onboarding"].includes(vacancyStatus)) {
    res.status(400).json({ error: "Invalid vacancy status." });
    return false;
  }
  await db.query("update labor_categories set vacancy_status = $2 where id = $1", [l.id, vacancyStatus]);
  await audit(db, req, "labor_category.vacancy_status", "labor_category", l.id, { vacancyStatus });
}));

// ---- Staff transfers -------------------------------------------------------------------------

router.post("/transfers", mutation(async (db, req, res) => {
  const staffId = Number(req.body?.staffId);
  const { rows } = await db.query("select * from staff where id = $1", [staffId]);
  const s = rows[0];
  if (!s) { res.status(404).json({ error: "Staff record not found." }); return false; }
  const hasAccess = await hasCallOrderAccess(pool, req.user!.id, req.user!.role, s.call_order_id);
  if (!hasAccess) { res.status(403).json({ error: "Access denied" }); return false; }
  const effectiveDate = str(req.body?.effectiveDate);
  const toCallOrderId = str(req.body?.toCallOrderId);
  const toLcat = str(req.body?.toLcat);
  if (!effectiveDate || (!toCallOrderId && !toLcat)) {
    res.status(400).json({ error: "Effective date and a target call order or LCAT are required." });
    return false;
  }
  const { rows: created } = await db.query<{ id: number }>(
    `insert into staff_transfers (staff_id, from_call_order_id, from_lcat, to_call_order_id, to_lcat, effective_date, notes)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [s.id, s.call_order_id, s.labor_category, toCallOrderId, toLcat, effectiveDate, str(req.body?.notes)],
  );
  await audit(db, req, "staff_transfer.create", "staff_transfer", created[0].id, { staffId: s.id, toCallOrderId, toLcat, effectiveDate });
}));

router.post("/transfers/:transferId/complete", mutation(async (db, req, res) => {
  const { rows } = await db.query(
    "select t.*, s.call_order_id as staff_call_order_id from staff_transfers t join staff s on s.id = t.staff_id where t.id = $1",
    [req.params.transferId],
  );
  const t = rows[0];
  if (!t) { res.status(404).json({ error: "Transfer not found." }); return false; }
  const hasAccess = await hasCallOrderAccess(pool, req.user!.id, req.user!.role, t.staff_call_order_id);
  if (!hasAccess) { res.status(403).json({ error: "Access denied" }); return false; }
  if (t.status === "completed") { res.status(400).json({ error: "Transfer is already completed." }); return false; }

  await captureStaffSnapshot(db, t.staff_call_order_id, req.user?.id ?? null, "update", t.staff_id, "Transfer completed");
  if (t.to_call_order_id) await db.query("update staff set call_order_id = $2 where id = $1", [t.staff_id, t.to_call_order_id]);
  if (t.to_lcat) await db.query("update staff set labor_category = $2 where id = $1", [t.staff_id, t.to_lcat]);
  await db.query("update staff_transfers set status = 'completed', completed_at = now() where id = $1", [t.id]);
  if (t.to_call_order_id) await captureStaffSnapshot(db, t.to_call_order_id, req.user?.id ?? null, "add", t.staff_id, "Transfer completed");

  await audit(db, req, "staff_transfer.complete", "staff_transfer", t.id, { staffId: t.staff_id });
}));

router.delete("/transfers/:transferId", mutation(async (db, req, res) => {
  const { rows } = await db.query(
    "select t.*, s.call_order_id as staff_call_order_id from staff_transfers t join staff s on s.id = t.staff_id where t.id = $1",
    [req.params.transferId],
  );
  const t = rows[0];
  if (!t) { res.status(404).json({ error: "Transfer not found." }); return false; }
  const hasAccess = await hasCallOrderAccess(pool, req.user!.id, req.user!.role, t.staff_call_order_id);
  if (!hasAccess) { res.status(403).json({ error: "Access denied" }); return false; }
  await db.query("delete from staff_transfers where id = $1", [t.id]);
  await audit(db, req, "staff_transfer.delete", "staff_transfer", t.id, {});
}));

export default router;
