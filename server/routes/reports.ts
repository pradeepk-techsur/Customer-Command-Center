import express from "express";
import { authenticateRequest, requireMeetingReportAccess } from "../auth-middleware.ts";
import { pool } from "../db.ts";
import { buildSnapshot } from "../snapshot.ts";
import { buildReportsData } from "../report-data.ts";

const router = express.Router();
router.use(authenticateRequest, requireMeetingReportAccess);

router.get("/", async (req, res, next) => {
  try {
    const snapshot = await buildSnapshot(pool, req.user!.id, req.user!.role);
    res.json(buildReportsData(snapshot.callOrders, snapshot.today));
  } catch (error) {
    next(error);
  }
});

export default router;
