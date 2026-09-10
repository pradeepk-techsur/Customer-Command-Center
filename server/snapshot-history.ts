import type { Queryable } from "./db.ts";

/**
 * Snapshot service for audit history tracking.
 * Captures complete state of call orders and staff rosters at each change.
 */

export interface CallOrderSnapshotData {
  funded: number;
  spend: number;
  eac: number | null;
  overUnder: number | null;
  pm: string;
  popStart: string | null;
  popEnd: string | null;
  popLabel: string;
  pending: boolean;
}

export interface StaffRosterData {
  id: number;
  name: string;
  laborCategory: string;
  rate: number;
  status: string;
  sortOrder: number;
}

/**
 * Capture a snapshot of call order financial state.
 * @param db Database connection
 * @param callOrderId Call order ID
 * @param userId User making the change
 * @param reason Optional reason for the change
 * @param changedFields Optional array of field names that changed
 * @returns Snapshot ID
 */
export async function captureCallOrderSnapshot(
  db: Queryable,
  callOrderId: string,
  userId: number | null,
  reason: string | null = null,
  changedFields: string[] | null = null
): Promise<number> {
  // Get current call order state
  const { rows } = await db.query(
    `select funded, spend, eac, over_under, pm, pop_start, pop_end, pop_label, pending
     from call_orders where id = $1`,
    [callOrderId]
  );

  if (rows.length === 0) {
    throw new Error(`Call order ${callOrderId} not found`);
  }

  const co = rows[0];

  // Insert snapshot
  const result = await db.query(
    `insert into call_order_snapshots 
     (call_order_id, funded, spend, eac, over_under, pm, pop_start, pop_end, pop_label, pending, 
      created_by_user_id, change_reason, changed_fields)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     returning id`,
    [
      callOrderId,
      co.funded,
      co.spend,
      co.eac,
      co.over_under,
      co.pm,
      co.pop_start,
      co.pop_end,
      co.pop_label,
      co.pending,
      userId,
      reason,
      changedFields ? JSON.stringify(changedFields) : null,
    ]
  );

  return result.rows[0].id;
}

/**
 * Capture a snapshot of staff roster.
 * @param db Database connection
 * @param callOrderId Call order ID
 * @param userId User making the change
 * @param changeType Type of change: add, update, delete
 * @param changedStaffId ID of staff member that changed
 * @param reason Optional reason for the change
 * @returns Snapshot ID
 */
export async function captureStaffSnapshot(
  db: Queryable,
  callOrderId: string,
  userId: number | null,
  changeType: 'add' | 'update' | 'delete' | null = null,
  changedStaffId: number | null = null,
  reason: string | null = null
): Promise<number> {
  // Get current staff roster
  const { rows } = await db.query(
    `select id, name, labor_category, rate, status, sort_order
     from staff 
     where call_order_id = $1
     order by sort_order, id`,
    [callOrderId]
  );

  // Convert to JSON array
  const roster = rows.map((s) => ({
    id: s.id,
    name: s.name,
    laborCategory: s.labor_category,
    rate: parseFloat(s.rate),
    status: s.status,
    sortOrder: s.sort_order,
  }));

  // Insert snapshot
  const result = await db.query(
    `insert into staff_snapshots 
     (call_order_id, staff_roster, created_by_user_id, change_reason, change_type, changed_staff_id)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [callOrderId, JSON.stringify(roster), userId, reason, changeType, changedStaffId]
  );

  return result.rows[0].id;
}

/**
 * Capture both call order and staff snapshots in a single transaction.
 * Use this when changes affect both financial and people data.
 * @param db Database connection
 * @param callOrderId Call order ID
 * @param userId User making the change
 * @param reason Optional reason for the change
 * @returns Object with both snapshot IDs
 */
export async function captureFullSnapshot(
  db: Queryable,
  callOrderId: string,
  userId: number | null,
  reason: string | null = null
): Promise<{ callOrderSnapshotId: number; staffSnapshotId: number }> {
  const callOrderSnapshotId = await captureCallOrderSnapshot(db, callOrderId, userId, reason);
  const staffSnapshotId = await captureStaffSnapshot(db, callOrderId, userId, null, null, reason);

  return { callOrderSnapshotId, staffSnapshotId };
}

/**
 * Link a snapshot to an audit log entry.
 * @param db Database connection
 * @param auditLogId Audit log entry ID
 * @param snapshotId Snapshot ID
 * @param snapshotType Type of snapshot: call_order or staff
 */
export async function linkSnapshotToAuditLog(
  db: Queryable,
  auditLogId: number,
  snapshotId: number,
  snapshotType: 'call_order' | 'staff'
): Promise<void> {
  await db.query(
    `update audit_log set snapshot_id = $1, snapshot_type = $2 where id = $3`,
    [snapshotId, snapshotType, auditLogId]
  );
}
