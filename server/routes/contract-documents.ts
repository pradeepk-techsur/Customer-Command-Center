import { readFile } from "node:fs/promises";
import express from "express";
import { authenticateRequest, requirePm } from "../auth-middleware.ts";
import { audit, mutation, num, str, bool, callOrderIdParam, requireScopedCallOrderAccess } from "../route-helpers.ts";
import { upload } from "../uploads.ts";
import { parseContractDocument } from "../contract-document-parser.ts";
import { captureContractDocumentSnapshot } from "../snapshot-history.ts";

const router = express.Router({ mergeParams: true });
router.use(authenticateRequest, requirePm, requireScopedCallOrderAccess);

router.post("/", upload.single("file"), mutation(async (db, req, res) => {
  const callOrderId = callOrderIdParam(req);
  const file = req.file as Express.Multer.File | undefined;
  if (!file) { res.status(400).json({ error: "A file is required." }); return false; }

  // The document is the source of truth: parse it and only fall back to submitted fields if extraction misses something.
  let parsed = { name: null, effectiveDate: null, isAdminMod: false, isFundingMod: false, fundingChangeAmount: null, popPeriodLabel: null } as Awaited<ReturnType<typeof parseContractDocument>>;
  try {
    parsed = await parseContractDocument(await readFile(file.path), file.mimetype);
  } catch (err) {
    console.error("Failed to parse contract document:", err);
  }

  const name = parsed.name ?? str(req.body?.name) ?? file.originalname;
  const isFundingMod = parsed.isFundingMod || bool(req.body?.isFundingMod);
  const { rows } = await db.query<{ id: number }>(
    `insert into contract_documents (call_order_id, name, file_href, is_admin_mod, is_funding_mod, funding_change_amount, pop_period_label, effective_date, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7,$8, coalesce((select max(sort_order) + 1 from contract_documents where call_order_id is not distinct from $1), 0)) returning id`,
    [callOrderId, name, `/uploads/${file.filename}`, parsed.isAdminMod || bool(req.body?.isAdminMod), isFundingMod,
     isFundingMod ? (parsed.fundingChangeAmount ?? num(req.body?.fundingChangeAmount)) : null,
     parsed.popPeriodLabel ?? str(req.body?.popPeriodLabel), parsed.effectiveDate ?? str(req.body?.effectiveDate)],
  );
  // Contract documents can be BPA-level (callOrderId null) — history is only tracked per call order.
  if (callOrderId) await captureContractDocumentSnapshot(db, callOrderId, req.user?.id ?? null, "add", rows[0].id, `Uploaded ${name}`);
  await audit(db, req, "contract_document.create", "contract_document", rows[0].id, { callOrderId, name });
}));

router.patch("/:documentId", mutation(async (db, req, res) => {
  const { rows } = await db.query("select * from contract_documents where id = $1", [req.params.documentId]);
  const doc = rows[0];
  if (!doc) { res.status(404).json({ error: "Document not found." }); return false; }
  const isFundingMod = req.body?.isFundingMod !== undefined ? bool(req.body.isFundingMod) : doc.is_funding_mod;
  if (doc.call_order_id) await captureContractDocumentSnapshot(db, doc.call_order_id, req.user?.id ?? null, "update", doc.id, `Updated ${doc.name}`);
  await db.query(
    `update contract_documents set name = $2, is_admin_mod = $3, is_funding_mod = $4, funding_change_amount = $5, pop_period_label = $6, effective_date = $7
     where id = $1`,
    [doc.id, str(req.body?.name) ?? doc.name, req.body?.isAdminMod !== undefined ? bool(req.body.isAdminMod) : doc.is_admin_mod,
     isFundingMod, isFundingMod ? (num(req.body?.fundingChangeAmount) ?? doc.funding_change_amount) : null,
     str(req.body?.popPeriodLabel) ?? doc.pop_period_label, str(req.body?.effectiveDate) ?? doc.effective_date],
  );
  await audit(db, req, "contract_document.update", "contract_document", doc.id, { name: doc.name });
}));

router.delete("/:documentId", mutation(async (db, req, res) => {
  const { rows: existing } = await db.query("select * from contract_documents where id = $1", [req.params.documentId]);
  const existingDoc = existing[0];
  if (existingDoc?.call_order_id) await captureContractDocumentSnapshot(db, existingDoc.call_order_id, req.user?.id ?? null, "delete", existingDoc.id, `Removed ${existingDoc.name}`);
  const { rows } = await db.query("delete from contract_documents where id = $1 returning *", [req.params.documentId]);
  if (!rows[0]) { res.status(404).json({ error: "Document not found." }); return false; }
  await audit(db, req, "contract_document.delete", "contract_document", rows[0].id, { name: rows[0].name });
}));

export default router;
