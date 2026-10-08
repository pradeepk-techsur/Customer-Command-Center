import { unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import express from "express";
import multer from "multer";
import { authenticateRequest, requirePm } from "../auth-middleware.ts";
import { withTransaction } from "../db.ts";
import { buildSnapshot } from "../snapshot.ts";
import { audit, mutation, str, callOrderIdParam, requireScopedCallOrderAccess } from "../route-helpers.ts";
import { uploadsDir } from "../uploads.ts";
import { parseInvoicePdf } from "../invoice-parser.ts";
import { validateInvoiceInput } from "../invoice-input.ts";
import type { InvoiceCreateInput, InvoicePreview } from "../../shared/types.ts";

const router = express.Router({ mergeParams: true });
router.use(authenticateRequest, requirePm, requireScopedCallOrderAccess);

const invoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

const receiveInvoice: express.RequestHandler = (req, res, next) => {
  invoiceUpload.single("file")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? "Invoice PDFs must be 50 MB or smaller." : "Only one invoice PDF may be uploaded." });
      return;
    }
    if (error) { next(error); return; }
    next();
  });
};

function checkedPdf(req: express.Request, res: express.Response, required: boolean): Express.Multer.File | null | undefined {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    if (required) res.status(400).json({ error: "Choose an invoice PDF." });
    return required ? null : undefined;
  }
  if (file.mimetype !== "application/pdf" || file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    res.status(400).json({ error: "Invoice documents must be PDF files." });
    return null;
  }
  return file;
}

router.post("/preview", receiveInvoice, async (req, res) => {
  const file = checkedPdf(req, res, true);
  if (!file) return;
  try {
    const parsed = await parseInvoicePdf(file.buffer);
    const draft: InvoiceCreateInput = {
      invoiceNumber: parsed.invoiceNumber ?? "",
      invoiceDate: parsed.invoiceDate ?? "",
      amount: parsed.amount === null ? "" : String(parsed.amount),
      periodStart: parsed.periodStart ?? "",
      periodEnd: parsed.periodEnd ?? "",
    };
    const warnings = [
      !draft.invoiceNumber && "Invoice number could not be read.",
      !draft.invoiceDate && "Invoice date could not be read.",
      !draft.amount && "Invoice amount could not be read.",
      !draft.periodStart && "Billing period start could not be read.",
      !draft.periodEnd && "Billing period end could not be read.",
    ].filter((warning): warning is string => Boolean(warning));
    res.json({ draft, warnings } satisfies InvoicePreview);
  } catch (error) {
    console.error("Failed to parse invoice PDF:", error);
    res.status(422).json({ error: "The invoice could not be read. Enter the invoice details manually or try another PDF." });
  }
});

router.post("/", receiveInvoice, async (req, res, next) => {
  let input: Partial<InvoiceCreateInput>;
  try {
    input = typeof req.body?.details === "string" ? JSON.parse(req.body.details) : req.body;
  } catch {
    res.status(400).json({ error: "The submitted invoice details are invalid." });
    return;
  }

  const checked = validateInvoiceInput(input);
  if (!checked.value) {
    res.status(400).json({ error: Object.values(checked.errors)[0] || "Review the invoice details.", fields: checked.errors });
    return;
  }

  const file = checkedPdf(req, res, false);
  if (file === null) return;
  const callOrderId = callOrderIdParam(req);
  const invoice = checked.value;
  let storedPath: string | null = null;
  let storedHref: string | null = null;

  try {
    if (file) {
      const safe = basename(file.originalname).replace(/[^\w.\- ]+/g, "_") || "invoice.pdf";
      const storedName = `${Date.now()}-${safe}`;
      storedPath = join(uploadsDir, storedName);
      storedHref = `/uploads/${storedName}`;
      await writeFile(storedPath, file.buffer);
    }

    const snapshot = await withTransaction(async (db) => {
      const { rows } = await db.query<{ id: number }>(
        `insert into invoices (call_order_id, invoice_number, invoice_date, amount, period_start, period_end, payment_status, file_href)
         values ($1,$2,$3,$4,$5,$6,'unpaid',$7) returning id`,
        [callOrderId, invoice.invoiceNumber, invoice.invoiceDate, invoice.amount, invoice.periodStart, invoice.periodEnd, storedHref],
      );
      await audit(db, req, "invoice.create", "invoice", rows[0].id, {
        callOrderId,
        source: file ? "pdf" : "manual",
        values: invoice,
      });
      return buildSnapshot(db, req.user!.id, req.user!.role);
    });
    res.status(201).json(snapshot);
  } catch (error) {
    if (storedPath) await unlink(storedPath).catch(() => undefined);
    next(error);
  }
});

router.patch("/:invoiceId", mutation(async (db, req, res) => {
  const callOrderId = callOrderIdParam(req);
  const { rows } = await db.query("select * from invoices where id = $1 and call_order_id is not distinct from $2", [req.params.invoiceId, callOrderId]);
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
    [inv.id, paymentStatus, paymentStatus === "paid" ? paidDate : paymentStatus === "unpaid" ? null : inv.paid_date],
  );
  await audit(db, req, "invoice.update", "invoice", inv.id, { paymentStatus });
}));

router.delete("/:invoiceId", mutation(async (db, req, res) => {
  const callOrderId = callOrderIdParam(req);
  const { rows } = await db.query("delete from invoices where id = $1 and call_order_id is not distinct from $2 returning *", [req.params.invoiceId, callOrderId]);
  if (!rows[0]) { res.status(404).json({ error: "Invoice not found." }); return false; }
  await audit(db, req, "invoice.delete", "invoice", rows[0].id, { invoiceNumber: rows[0].invoice_number });
}));

export default router;
