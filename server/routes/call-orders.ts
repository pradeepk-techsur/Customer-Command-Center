import express from "express";
import multer from "multer";
import { unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { authenticateRequest, requireProgramManager } from "../auth-middleware.ts";
import { withTransaction } from "../db.ts";
import { formatPop } from "../dates.ts";
import { buildSnapshot } from "../snapshot.ts";
import { audit, mutation } from "../route-helpers.ts";
import { captureCallOrderSnapshot } from "../snapshot-history.ts";
import { uploadsDir } from "../uploads.ts";
import { parseCallOrderAward } from "../call-order-award-parser.ts";
import { validateCallOrderSetup } from "../call-order-setup.ts";
import type { CallOrderSetupInput } from "../../shared/types.ts";

const router = express.Router();
const awardUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});
const acceptedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function awardFile(req: express.Request, res: express.Response): Express.Multer.File | null | undefined {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ error: "An award document is required." });
    return null;
  }
  if (!acceptedTypes.has(file.mimetype)) {
    res.status(400).json({ error: "Award documents must be PDF or DOCX files." });
    return null;
  }
  return file;
}

router.post("/award-preview", authenticateRequest, requireProgramManager, awardUpload.single("award"), async (req, res) => {
  const file = awardFile(req, res);
  if (!file) return;
  try {
    res.json(await parseCallOrderAward(file.buffer, file.mimetype));
  } catch (error) {
    console.error("Failed to parse call-order award:", error);
    res.status(422).json({ error: "The award could not be read. Enter the call-order details manually or try another PDF or DOCX." });
  }
});

router.post("/", authenticateRequest, requireProgramManager, awardUpload.single("award"), async (req, res, next) => {
  let input: Partial<CallOrderSetupInput>;
  try {
    input = typeof req.body?.details === "string" ? JSON.parse(req.body.details) : req.body;
  } catch {
    res.status(400).json({ error: "The submitted call-order details are invalid." });
    return;
  }

  const checked = validateCallOrderSetup(input, true);
  if (!checked.value) {
    res.status(400).json({ error: Object.values(checked.errors)[0] || "Review the call-order details.", fields: checked.errors });
    return;
  }
  const setup = checked.value;
  const file = req.file as Express.Multer.File | undefined;
  if (file && !acceptedTypes.has(file.mimetype)) {
    res.status(400).json({ error: "Award documents must be PDF or DOCX files." });
    return;
  }

  let preview = null;
  if (file) {
    try {
      preview = await parseCallOrderAward(file.buffer, file.mimetype);
    } catch (error) {
      console.error("Failed to parse retained call-order award:", error);
    }
  }

  let storedPath: string | null = null;
  let storedHref: string | null = null;
  try {
    if (file) {
      const safe = basename(file.originalname).replace(/[^\w.\- ]+/g, "_");
      const storedName = `${Date.now()}-${safe}`;
      storedPath = join(uploadsDir, storedName);
      storedHref = `/uploads/${storedName}`;
      await writeFile(storedPath, file.buffer);
    }

    const snapshot = await withTransaction(async (db) => {
      const duplicate = await db.query(
        "select id from call_orders where id = $1 or group_key = $2 limit 1",
        [setup.id, setup.groupKey],
      );
      if (duplicate.rows[0]) {
        const error = new Error("That call-order number already exists.") as Error & { status?: number };
        error.status = 409;
        throw error;
      }

      await db.query(
        `insert into call_orders
          (id, group_key, group_name, name, description, narrative, pop_label, pop_start, pop_end,
           funded, spend, eac, over_under, pm, pending, highlights, sort_order)
         values ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false,'[]'::jsonb,
           coalesce((select max(sort_order) + 1 from call_orders), 0))`,
        [setup.id, setup.groupKey, setup.name, setup.description, setup.narrative, formatPop(setup.popStart, setup.popEnd),
          setup.popStart, setup.popEnd, setup.funded, setup.spend, setup.eac, setup.overUnder, setup.pm],
      );

      let documentId: number | null = null;
      if (file && storedHref) {
        const documentName = preview?.externalOrderNumber ? `Base Award - ${preview.externalOrderNumber}` : `Base Award - ${file.originalname}`;
        const result = await db.query<{ id: number }>(
          `insert into contract_documents
            (call_order_id, name, file_href, is_admin_mod, is_funding_mod, pop_period_label, effective_date, sort_order)
           values ($1,$2,$3,false,false,'Base',$4,0) returning id`,
          [setup.id, documentName, storedHref, preview?.awardDate ?? null],
        );
        documentId = result.rows[0].id;
      }

      await audit(db, req, "call_order.create", "call_order", setup.id!, {
        mode: file ? "award" : "manual",
        groupKey: setup.groupKey,
        externalOrderNumber: preview?.externalOrderNumber ?? null,
        documentId,
        values: setup,
      });
      return buildSnapshot(db, req.user!.id, req.user!.role);
    });
    res.status(201).json(snapshot);
  } catch (error) {
    if (storedPath) await unlink(storedPath).catch(() => undefined);
    const status = (error as { status?: number }).status;
    if (status) {
      res.status(status).json({ error: (error as Error).message });
      return;
    }
    next(error);
  }
});

router.patch("/:id/setup", authenticateRequest, requireProgramManager, mutation(async (db, req, res) => {
  const { rows } = await db.query("select * from call_orders where id = $1", [req.params.id]);
  const current = rows[0];
  if (!current) {
    res.status(404).json({ error: "Call order not found." });
    return false;
  }

  const checked = validateCallOrderSetup({
    name: req.body?.name ?? current.name,
    description: req.body?.description ?? current.description,
    narrative: req.body?.narrative ?? current.narrative,
    popStart: req.body?.popStart ?? current.pop_start,
    popEnd: req.body?.popEnd ?? current.pop_end,
    funded: req.body?.funded ?? String(current.funded),
    spend: req.body?.spend ?? String(current.spend),
    eac: req.body?.eac ?? (current.eac === null ? "" : String(current.eac)),
    overUnder: req.body?.overUnder ?? (current.over_under === null ? "" : String(current.over_under)),
    pm: req.body?.pm ?? current.pm,
  }, false);
  if (!checked.value) {
    res.status(400).json({ error: Object.values(checked.errors)[0] || "Review the call-order details.", fields: checked.errors });
    return false;
  }
  const setup = checked.value;
  const changedFinancialFields = ["funded", "spend", "eac", "over_under", "pop_start", "pop_end", "pm"];
  await captureCallOrderSnapshot(db, current.id, req.user?.id ?? null, "Call order setup updated", changedFinancialFields);
  await db.query(
    `update call_orders set group_name = $2, name = $2, description = $3, narrative = $4 where group_key = $1`,
    [current.group_key, setup.name, setup.description, setup.narrative],
  );
  await db.query(
    `update call_orders set pop_label = $2, pop_start = $3, pop_end = $4, funded = $5, spend = $6,
       eac = $7, over_under = $8, pm = $9, pending = false, fin_updated_on = current_date where id = $1`,
    [current.id, formatPop(setup.popStart, setup.popEnd), setup.popStart, setup.popEnd, setup.funded,
      setup.spend, setup.eac, setup.overUnder, setup.pm],
  );
  await audit(db, req, "call_order.setup", "call_order", current.id, {
    groupKey: current.group_key,
    from: {
      name: current.name, description: current.description, narrative: current.narrative,
      popStart: current.pop_start, popEnd: current.pop_end, funded: current.funded, spend: current.spend,
      eac: current.eac, overUnder: current.over_under, pm: current.pm,
    },
    to: setup,
  });
}));

export default router;
