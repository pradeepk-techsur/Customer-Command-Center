import { pool } from "./db.ts";
import { sendDocumentNotificationEmail } from "./email-service.ts";

interface NotificationJob {
  id: number;
  recipient_user_id: number;
  recipient_email: string;
  call_order_id: string | null;
  requires_assigned_call_order: boolean;
  document_type: string;
  document_name: string;
  scope_label: string | null;
  period_label: string | null;
  uploaded_by: string | null;
  dashboard_path: string;
  attempts: number;
}

const POLL_MS = Math.max(1_000, Number(process.env.EMAIL_QUEUE_POLL_MS) || 15_000);
const MAX_ATTEMPTS = Math.max(1, Number(process.env.EMAIL_QUEUE_MAX_ATTEMPTS) || 5);
const BATCH_SIZE = Math.max(1, Math.min(50, Number(process.env.EMAIL_QUEUE_BATCH_SIZE) || 10));

async function claimJob(id: number): Promise<NotificationJob | null> {
  const { rows } = await pool.query<NotificationJob>(
    `update email_notification_jobs
        set status = 'processing', locked_at = now(), attempts = attempts + 1
      where id = $1
        and ((status = 'pending' and next_attempt_at <= now())
          or (status = 'processing' and locked_at < now() - interval '10 minutes'))
      returning *`,
    [id],
  );
  return rows[0] ?? null;
}

async function currentRecipient(job: NotificationJob): Promise<string | null> {
  const params: unknown[] = [job.recipient_user_id];
  let access = "";
  if (job.call_order_id) {
    params.push(job.call_order_id);
    access = `and exists (
      select 1 from user_call_orders uco
       where uco.user_id = u.id and uco.call_order_id = $2
    )`;
  } else if (job.requires_assigned_call_order) {
    access = "and exists (select 1 from user_call_orders uco where uco.user_id = u.id)";
  }
  const { rows } = await pool.query<{ email: string }>(
    `select lower(u.email) as email from users u
      where u.id = $1 and u.role = 'customer' and u.status = 'active' ${access}`,
    params,
  );
  return rows[0]?.email ?? null;
}

async function processJob(candidateId: number): Promise<void> {
  const job = await claimJob(candidateId);
  if (!job) return;

  const email = await currentRecipient(job);
  if (!email) {
    await pool.query(
      "update email_notification_jobs set status = 'skipped', locked_at = null, last_error = 'Recipient is no longer authorized' where id = $1",
      [job.id],
    );
    return;
  }

  try {
    await sendDocumentNotificationEmail(email, {
      documentType: job.document_type,
      documentName: job.document_name,
      scopeLabel: job.scope_label,
      periodLabel: job.period_label,
      uploadedBy: job.uploaded_by,
      dashboardPath: job.dashboard_path,
    });
    await pool.query(
      "update email_notification_jobs set status = 'sent', sent_at = now(), locked_at = null, last_error = null where id = $1",
      [job.id],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "Unknown email delivery error";
    const terminal = job.attempts >= MAX_ATTEMPTS;
    const delayMinutes = Math.min(60, 2 ** Math.max(0, job.attempts - 1));
    await pool.query(
      `update email_notification_jobs
          set status = $2, locked_at = null, last_error = $3,
              next_attempt_at = now() + ($4 * interval '1 minute')
        where id = $1`,
      [job.id, terminal ? "failed" : "pending", message, delayMinutes],
    );
    console.error(`Document notification job ${job.id} failed (attempt ${job.attempts}/${MAX_ATTEMPTS}):`, error);
  }
}

let running = false;

export async function processNotificationQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { rows } = await pool.query<{ id: number }>(
      `select id from email_notification_jobs
        where (status = 'pending' and next_attempt_at <= now())
           or (status = 'processing' and locked_at < now() - interval '10 minutes')
        order by id limit $1`,
      [BATCH_SIZE],
    );
    await Promise.all(rows.map((row) => processJob(row.id)));
  } finally {
    running = false;
  }
}

export function startNotificationWorker(): ReturnType<typeof setInterval> {
  void processNotificationQueue().catch((error) => console.error("Notification queue error:", error));
  const timer = setInterval(() => {
    void processNotificationQueue().catch((error) => console.error("Notification queue error:", error));
  }, POLL_MS);
  timer.unref();
  return timer;
}
