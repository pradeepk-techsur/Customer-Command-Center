import type { Queryable } from "./db.ts";

export interface DocumentNotificationInput {
  eventKey: string;
  documentType: string;
  documentName: string;
  callOrderId: string | null;
  scopeLabel?: string | null;
  periodLabel?: string | null;
  uploadedBy?: string | null;
  uploaderUserId?: number | null;
  dashboardPath?: string;
  /** BPA reports require at least one assigned call order to appear in a customer's snapshot. */
  requireAssignedCallOrder?: boolean;
}

interface RecipientRow {
  id: number;
  email: string;
}

/**
 * Add one durable outbox job for every active customer who can see the document.
 * Call this inside the same transaction that publishes the document.
 */
export async function enqueueDocumentNotifications(
  db: Queryable,
  input: DocumentNotificationInput,
): Promise<number> {
  const params: unknown[] = [input.uploaderUserId ?? null];
  let accessClause = "";

  if (input.callOrderId) {
    params.push(input.callOrderId);
    accessClause = `and exists (
      select 1 from user_call_orders uco
       where uco.user_id = u.id and uco.call_order_id = $2
    )`;
  } else if (input.requireAssignedCallOrder) {
    accessClause = "and exists (select 1 from user_call_orders uco where uco.user_id = u.id)";
  }

  const { rows: recipients } = await db.query<RecipientRow>(
    `select u.id, lower(u.email) as email
       from users u
      where u.role = 'customer'
        and u.status = 'active'
        and ($1::integer is null or u.id <> $1)
        ${accessClause}
      order by u.id`,
    params,
  );

  let queued = 0;
  for (const recipient of recipients) {
    const result = await db.query(
      `insert into email_notification_jobs
        (event_key, recipient_user_id, recipient_email, call_order_id, requires_assigned_call_order, document_type,
         document_name, scope_label, period_label, uploaded_by, dashboard_path)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (event_key, recipient_user_id) do nothing`,
      [
        input.eventKey,
        recipient.id,
        recipient.email,
        input.callOrderId,
        input.requireAssignedCallOrder ?? false,
        input.documentType,
        input.documentName,
        input.scopeLabel ?? null,
        input.periodLabel ?? null,
        input.uploadedBy ?? null,
        input.dashboardPath ?? "/",
      ],
    );
    queued += result.rowCount ?? 0;
  }

  return queued;
}
