import express from "express";
import type { Queryable } from "../db.ts";
import { pool, withTransaction } from "../db.ts";
import { authenticateRequest, requireMeetingReportAccess } from "../auth-middleware.ts";
import { audit, type Db } from "../route-helpers.ts";
import type { WeeklyMeeting, WeeklyMeetingAction } from "../../shared/types.ts";

const router = express.Router();
router.use(authenticateRequest, requireMeetingReportAccess);

const iso = (value: unknown): string => value instanceof Date ? value.toISOString() : String(value);
const text = (value: unknown): string => String(value ?? "").trim();

export function validIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

export function validateMeetingInput(body: unknown): { meetingDate: string; agenda: string } | null {
  const input = (body || {}) as { meetingDate?: unknown; agenda?: unknown };
  const meetingDate = text(input.meetingDate);
  const agenda = text(input.agenda);
  return validIsoDate(meetingDate) && agenda ? { meetingDate, agenda } : null;
}

export function validateMeetingActionInput(body: unknown): { name: string; description: string | null } | null {
  const input = (body || {}) as { name?: unknown; description?: unknown; assignedTo?: unknown };
  const name = text(input.name ?? input.assignedTo);
  const description = text(input.description) || null;
  return name ? { name, description } : null;
}

export function validateMeetingActions(body: unknown): Array<{ name: string; description: string | null }> | null {
  const actions = (body as { actions?: unknown } | null)?.actions;
  if (actions === undefined) return [];
  if (!Array.isArray(actions) || actions.length > 100) return null;
  const validated = actions.map(validateMeetingActionInput);
  return validated.every((action) => action !== null)
    ? validated as Array<{ name: string; description: string | null }>
    : null;
}

async function insertMeetingActions(
  db: Db,
  req: express.Request,
  meetingId: number,
  actions: Array<{ name: string; description: string | null }>,
): Promise<void> {
  for (const action of actions) {
    const { rows } = await db.query<{ id: number }>(
      `insert into action_items (weekly_meeting_id, call_order_id, name, description, date_assigned)
       values ($1,null,$2,$3,current_date) returning id`,
      [meetingId, action.name, action.description],
    );
    await audit(db, req, "action_item.create", "action_item", rows[0].id, {
      weeklyMeetingId: meetingId, ...action, status: "open",
    });
  }
}

async function loadMeetings(db: Queryable): Promise<WeeklyMeeting[]> {
  const [meetingsResult, actionsResult] = await Promise.all([
    db.query("select * from weekly_meetings order by meeting_date desc, id desc"),
    db.query("select * from action_items where weekly_meeting_id is not null order by weekly_meeting_id, case when status = 'open' then 0 else 1 end, created_at, id"),
  ]);
  return meetingsResult.rows.map((meeting): WeeklyMeeting => ({
    id: meeting.id,
    meetingDate: meeting.meeting_date,
    agenda: meeting.agenda,
    createdAt: iso(meeting.created_at),
    updatedAt: iso(meeting.updated_at),
    createdBy: meeting.created_by,
    updatedBy: meeting.updated_by,
    actions: actionsResult.rows
      .filter((action) => action.weekly_meeting_id === meeting.id)
      .map((action): WeeklyMeetingAction => ({
        id: action.id,
        name: action.name,
        description: action.description,
        dateAssigned: action.date_assigned,
        status: action.status,
        createdAt: iso(action.created_at),
        closedAt: action.closed_at ? iso(action.closed_at) : null,
      })),
  }));
}

router.get("/", async (_req, res, next) => {
  try {
    res.json({ meetings: await loadMeetings(pool) });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  const input = validateMeetingInput(req.body);
  if (!input) { res.status(400).json({ error: "Meeting date and agenda are required." }); return; }
  const actions = validateMeetingActions(req.body);
  if (!actions) { res.status(400).json({ error: "Every action item requires a name." }); return; }
  try {
    const meetings = await withTransaction(async (db) => {
      const { rows } = await db.query<{ id: number }>(
        "insert into weekly_meetings (meeting_date, agenda, created_by, updated_by) values ($1,$2,$3,$3) returning id",
        [input.meetingDate, input.agenda, req.user!.id],
      );
      await audit(db, req, "weekly_meeting.create", "weekly_meeting", rows[0].id, input);
      await insertMeetingActions(db, req, rows[0].id, actions);
      return loadMeetings(db);
    });
    res.status(201).json({ meetings });
  } catch (error) { next(error); }
});

router.patch("/:meetingId", async (req, res, next) => {
  const input = validateMeetingInput(req.body);
  if (!input) { res.status(400).json({ error: "Meeting date and agenda are required." }); return; }
  const actions = validateMeetingActions(req.body);
  if (!actions) { res.status(400).json({ error: "Every action item requires a name." }); return; }
  try {
    const meetings = await withTransaction(async (db) => {
      const { rows } = await db.query("select * from weekly_meetings where id = $1", [req.params.meetingId]);
      const before = rows[0];
      if (!before) return null;
      await db.query(
        "update weekly_meetings set meeting_date = $2, agenda = $3, updated_by = $4, updated_at = now() where id = $1",
        [before.id, input.meetingDate, input.agenda, req.user!.id],
      );
      await audit(db, req, "weekly_meeting.update", "weekly_meeting", before.id, {
        before: { meetingDate: before.meeting_date, agenda: before.agenda }, after: input,
      });
      await insertMeetingActions(db, req, before.id, actions);
      return loadMeetings(db);
    });
    if (!meetings) { res.status(404).json({ error: "Weekly meeting not found." }); return; }
    res.json({ meetings });
  } catch (error) { next(error); }
});

router.delete("/:meetingId", async (req, res, next) => {
  try {
    const meetings = await withTransaction(async (db) => {
      const { rows } = await db.query("select * from weekly_meetings where id = $1", [req.params.meetingId]);
      const meeting = rows[0];
      if (!meeting) return null;
      const actions = await db.query("select id, name, description, status, closed_at from action_items where weekly_meeting_id = $1 order by id", [meeting.id]);
      await db.query("delete from weekly_meetings where id = $1", [meeting.id]);
      await audit(db, req, "weekly_meeting.delete", "weekly_meeting", meeting.id, {
        meetingDate: meeting.meeting_date, agenda: meeting.agenda,
        actions: actions.rows.map((action) => ({ id: action.id, name: action.name, description: action.description, status: action.status, closedAt: action.closed_at })),
      });
      return loadMeetings(db);
    });
    if (!meetings) { res.status(404).json({ error: "Weekly meeting not found." }); return; }
    res.json({ meetings });
  } catch (error) { next(error); }
});

router.post("/:meetingId/actions", async (req, res, next) => {
  const input = validateMeetingActionInput(req.body);
  if (!input) { res.status(400).json({ error: "A name is required." }); return; }
  try {
    const meetings = await withTransaction(async (db) => {
      const meeting = await db.query("select id from weekly_meetings where id = $1", [req.params.meetingId]);
      if (!meeting.rows[0]) return null;
      const { rows } = await db.query<{ id: number }>(
        `insert into action_items (weekly_meeting_id, call_order_id, name, description, date_assigned)
         values ($1,null,$2,$3,current_date) returning id`,
        [meeting.rows[0].id, input.name, input.description],
      );
      await audit(db, req, "action_item.create", "action_item", rows[0].id, { weeklyMeetingId: meeting.rows[0].id, ...input, status: "open" });
      return loadMeetings(db);
    });
    if (!meetings) { res.status(404).json({ error: "Weekly meeting not found." }); return; }
    res.status(201).json({ meetings });
  } catch (error) { next(error); }
});

router.patch("/:meetingId/actions/:actionId", async (req, res, next) => {
  try {
    const meetings = await withTransaction(async (db) => {
      const { rows } = await db.query("select * from action_items where id = $1 and weekly_meeting_id = $2", [req.params.actionId, req.params.meetingId]);
      const before = rows[0];
      if (!before) return null;
      const input = validateMeetingActionInput({
        name: req.body?.name ?? req.body?.assignedTo ?? before.name,
        description: req.body?.description === undefined ? before.description : req.body.description,
      });
      const status = req.body?.status === undefined ? before.status : text(req.body.status);
      if (!input || !["open", "closed"].includes(status)) return "invalid" as const;
      const closedAt = status === "closed" && before.status !== "closed" ? new Date() : status === "open" ? null : before.closed_at;
      await db.query("update action_items set name = $2, description = $3, status = $4, closed_at = $5 where id = $1", [before.id, input.name, input.description, status, closedAt]);
      await db.query("update weekly_meetings set updated_by = $2, updated_at = now() where id = $1", [before.weekly_meeting_id, req.user!.id]);
      await audit(db, req, before.status === status ? "action_item.update" : "action_item.status", "action_item", before.id, {
        weeklyMeetingId: before.weekly_meeting_id,
        before: { name: before.name, description: before.description, status: before.status },
        after: { ...input, status },
      });
      return loadMeetings(db);
    });
    if (meetings === "invalid") { res.status(400).json({ error: "A name and valid status are required." }); return; }
    if (!meetings) { res.status(404).json({ error: "Meeting action item not found." }); return; }
    res.json({ meetings });
  } catch (error) { next(error); }
});

router.delete("/:meetingId/actions/:actionId", async (req, res, next) => {
  try {
    const meetings = await withTransaction(async (db) => {
      const { rows } = await db.query("delete from action_items where id = $1 and weekly_meeting_id = $2 returning *", [req.params.actionId, req.params.meetingId]);
      const action = rows[0];
      if (!action) return null;
      await db.query("update weekly_meetings set updated_by = $2, updated_at = now() where id = $1", [action.weekly_meeting_id, req.user!.id]);
      await audit(db, req, "action_item.delete", "action_item", action.id, {
        weeklyMeetingId: action.weekly_meeting_id, name: action.name, description: action.description, status: action.status,
      });
      return loadMeetings(db);
    });
    if (!meetings) { res.status(404).json({ error: "Meeting action item not found." }); return; }
    res.json({ meetings });
  } catch (error) { next(error); }
});

export default router;
