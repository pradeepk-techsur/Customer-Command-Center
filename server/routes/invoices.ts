import { readFile } from "node:fs/promises";
import express from "express";
import { authenticateRequest, requirePm } from "../auth-middleware.ts";
import { audit, mutation, num, str, callOrderIdParam, requireScopedCallOrderAccess } from "../route-helpers.ts";
import { upload } from "../uploads.ts";
import { parseInvoicePdf } from "../invoice-parser.ts";

const router = express.Router({ mergeParams: true });
router.use(authenticateRequest, requirePm, requireScopedCallOrderAccess);

router.post("/", upload.single("file"), mutation(async (db, req, res) => {
  const callOrderId = callOrderIdParam(req);
  const file = req.file as Express.Multer.File | undefined;

  // The invoice PDF is the source of truth: parse it and only fall back to submitted fields if extraction misses something.
  let parsed = { invoiceNumber: null, invoiceDate: null, amount: null, periodEnd: null } as Awaited<ReturnType<typeof parseInvoicePdf>>;
  if (file && file.mimetype === "application/pdf") {
    try {
      parsed = await parseInvoicePdf(await readFile(file.path));
    } catch (err) {
      console.error("Failed to parse invoice PDF:", err);
    }
  }

  const invoiceNumber = parsed.invoiceNumber ?? str(req.body?.invoiceNumber);
  const invoiceDate = parsed.invoiceDate ?? str(req.body?.invoiceDate);
  const amount = parsed.amount ?? num(req.body?.amount);
  const periodEnd = parsed.periodEnd ?? str(req.body?.periodEnd);
  if (!invoiceNumber || !invoiceDate || amount === null) {
    res.status(400).json({ error: "Could not read invoice number, date, and amount from the file. Please check the file and try again." });
    return false;
  }
  const { rows } = await db.query<{ id: number }>(
    `insert into invoices (call_order_id, invoice_number, invoice_date, amount, period_start, period_end, payment_status, file_href)
     values ($1,$2,$3,$4,$5,$6,'unpaid',$7) returning id`,
    [callOrderId, invoiceNumber, invoiceDate, amount, str(req.body?.periodStart), periodEnd, file ? `/uploads/${file.filename}` : null],
  );
  await audit(db, req, "invoice.create", "invoice", rows[0].id, { callOrderId, invoiceNumber, amount });
}));

router.patch("/:invoiceId", mutation(async (db, req, res) => {
  const { rows } = await db.query("select * from invoices where id = $1", [req.params.invoiceId]);
  const inv = rows[0];
  if (!inv) { res.status(404).json({ error: "Invoice not found." }); return false; }
  const paymentStatus = str(req.body?.paymentStatus);
  if (paymentStatus && !["unpaid", "paid"].includes(paymentStatus)) {
    res.status(400).json({ error: "Invalid payment status." });
    return false;
  }
  const paidDate = paymentStatus === "paid" ? (str(req.body?.paidDate) || new Date().toISOString().slice(0, 10)) : null;
  await db.query(
    "update invoices set payment_status = coalesce($2, payment_status), paid_date = $3 where id = $1",
    [inv.id, paymentStatus, paymentStatus === "paid" ? paidDate : inv.paid_date],
  );
  await audit(db, req, "invoice.update", "invoice", inv.id, { paymentStatus });
}));

router.delete("/:invoiceId", mutation(async (db, req, res) => {
  const { rows } = await db.query("delete from invoices where id = $1 returning *", [req.params.invoiceId]);
  if (!rows[0]) { res.status(404).json({ error: "Invoice not found." }); return false; }
  await audit(db, req, "invoice.delete", "invoice", rows[0].id, { invoiceNumber: rows[0].invoice_number });
}));

export default router;
