import type { Queryable } from "./db.ts";
import type { CallOrderSnapshot, StaffSnapshot, AuditLogEntry, HistoryTimelineEntry } from "../shared/types.ts";

/**
 * History query service for retrieving audit snapshots and building timelines.
 */

/**
 * Get all snapshots for a call order, ordered by time (most recent first).
 * @param db Database connection
 * @param callOrderId Call order ID
 * @param startDate Optional start date filter (ISO string)
 * @param endDate Optional end date filter (ISO string)
 * @param includeUserInfo Include user names (false for customers)
 * @returns Array of call order snapshots
 */
export async function getCallOrderHistory(
  db: Queryable,
  callOrderId: string,
  startDate?: string,
  endDate?: string,
  includeUserInfo: boolean = true
): Promise<CallOrderSnapshot[]> {
  let query = `
    select 
      s.id, s.call_order_id, s.snapshot_time, s.funded, s.spend, s.eac, s.over_under,
      s.pm, s.pop_start, s.pop_end, s.pop_label, s.pending,
      s.created_by_user_id, s.change_reason, s.changed_fields, s.created_at
      ${includeUserInfo ? ', u.name as created_by_user_name' : ''}
    from call_order_snapshots s
    ${includeUserInfo ? 'left join users u on s.created_by_user_id = u.id' : ''}
    where s.call_order_id = $1
  `;

  const params: any[] = [callOrderId];
  let paramIndex = 2;

  if (startDate) {
    query += ` and s.snapshot_time >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    query += ` and s.snapshot_time <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  query += ` order by s.snapshot_time desc`;

  const { rows } = await db.query(query, params);

  return rows.map((r) => ({
    id: r.id,
    callOrderId: r.call_order_id,
    snapshotTime: r.snapshot_time.toISOString(),
    funded: parseFloat(r.funded),
    spend: parseFloat(r.spend),
    eac: r.eac ? parseFloat(r.eac) : null,
    overUnder: r.over_under ? parseFloat(r.over_under) : null,
    pm: r.pm,
    popStart: r.pop_start,
    popEnd: r.pop_end,
    popLabel: r.pop_label,
    pending: r.pending,
    createdByUserId: r.created_by_user_id,
    createdByUserName: includeUserInfo ? r.created_by_user_name : undefined,
    changeReason: r.change_reason,
    changedFields: r.changed_fields,
    createdAt: r.created_at.toISOString(),
  }));
}

/**
 * Get staff snapshots for a call order.
 * @param db Database connection
 * @param callOrderId Call order ID
 * @param startDate Optional start date filter
 * @param endDate Optional end date filter
 * @param includeUserInfo Include user names (false for customers)
 * @returns Array of staff snapshots
 */
export async function getStaffHistory(
  db: Queryable,
  callOrderId: string,
  startDate?: string,
  endDate?: string,
  includeUserInfo: boolean = true
): Promise<StaffSnapshot[]> {
  let query = `
    select 
      s.id, s.call_order_id, s.snapshot_time, s.staff_roster,
      s.created_by_user_id, s.change_reason, s.change_type, s.changed_staff_id, s.created_at
      ${includeUserInfo ? ', u.name as created_by_user_name' : ''}
    from staff_snapshots s
    ${includeUserInfo ? 'left join users u on s.created_by_user_id = u.id' : ''}
    where s.call_order_id = $1
  `;

  const params: any[] = [callOrderId];
  let paramIndex = 2;

  if (startDate) {
    query += ` and s.snapshot_time >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    query += ` and s.snapshot_time <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  query += ` order by s.snapshot_time desc`;

  const { rows } = await db.query(query, params);

  return rows.map((r) => ({
    id: r.id,
    callOrderId: r.call_order_id,
    snapshotTime: r.snapshot_time.toISOString(),
    staffRoster: r.staff_roster,
    createdByUserId: r.created_by_user_id,
    createdByUserName: includeUserInfo ? r.created_by_user_name : undefined,
    changeReason: r.change_reason,
    changeType: r.change_type,
    changedStaffId: r.changed_staff_id,
    createdAt: r.created_at.toISOString(),
  }));
}

/**
 * Get call order state at a specific point in time.
 * Returns the most recent snapshot before or at the target date.
 * @param db Database connection
 * @param callOrderId Call order ID
 * @param targetDate ISO date/timestamp
 * @returns Snapshot or null if no snapshots exist before target date
 */
export async function getCallOrderAtDate(
  db: Queryable,
  callOrderId: string,
  targetDate: string
): Promise<CallOrderSnapshot | null> {
  const { rows } = await db.query(
    `select 
      s.id, s.call_order_id, s.snapshot_time, s.funded, s.spend, s.eac, s.over_under,
      s.pm, s.pop_start, s.pop_end, s.pop_label, s.pending,
      s.created_by_user_id, s.change_reason, s.changed_fields, s.created_at,
      u.name as created_by_user_name
    from call_order_snapshots s
    left join users u on s.created_by_user_id = u.id
    where s.call_order_id = $1 and s.snapshot_time <= $2
    order by s.snapshot_time desc
    limit 1`,
    [callOrderId, targetDate]
  );

  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    id: r.id,
    callOrderId: r.call_order_id,
    snapshotTime: r.snapshot_time.toISOString(),
    funded: parseFloat(r.funded),
    spend: parseFloat(r.spend),
    eac: r.eac ? parseFloat(r.eac) : null,
    overUnder: r.over_under ? parseFloat(r.over_under) : null,
    pm: r.pm,
    popStart: r.pop_start,
    popEnd: r.pop_end,
    popLabel: r.pop_label,
    pending: r.pending,
    createdByUserId: r.created_by_user_id,
    createdByUserName: r.created_by_user_name,
    changeReason: r.change_reason,
    changedFields: r.changed_fields,
    createdAt: r.created_at.toISOString(),
  };
}

/**
 * Compare call order state between two dates.
 * @param db Database connection
 * @param callOrderId Call order ID
 * @param date1 Earlier date (ISO string)
 * @param date2 Later date (ISO string)
 * @returns Comparison object with before/after snapshots and differences
 */
export async function compareCallOrderStates(
  db: Queryable,
  callOrderId: string,
  date1: string,
  date2: string
): Promise<{
  before: CallOrderSnapshot | null;
  after: CallOrderSnapshot | null;
  changes: Array<{ field: string; before: any; after: any }>;
}> {
  const before = await getCallOrderAtDate(db, callOrderId, date1);
  const after = await getCallOrderAtDate(db, callOrderId, date2);

  const changes: Array<{ field: string; before: any; after: any }> = [];

  if (before && after) {
    // Compare financial fields
    if (before.funded !== after.funded) {
      changes.push({ field: 'funded', before: before.funded, after: after.funded });
    }
    if (before.spend !== after.spend) {
      changes.push({ field: 'spend', before: before.spend, after: after.spend });
    }
    if (before.eac !== after.eac) {
      changes.push({ field: 'eac', before: before.eac, after: after.eac });
    }
    if (before.pm !== after.pm) {
      changes.push({ field: 'pm', before: before.pm, after: after.pm });
    }
    if (before.pending !== after.pending) {
      changes.push({ field: 'pending', before: before.pending, after: after.pending });
    }
  }

  return { before, after, changes };
}

/**
 * Get recent changes across all or specific call orders.
 * @param db Database connection
 * @param limit Maximum number of changes to return
 * @param callOrderIds Optional array of call order IDs to filter
 * @param includeUserInfo Include user names (false for customers)
 * @returns Array of recent changes
 */
export async function getRecentChanges(
  db: Queryable,
  limit: number = 50,
  callOrderIds?: string[],
  includeUserInfo: boolean = true
): Promise<Array<{ snapshot: CallOrderSnapshot | StaffSnapshot; type: 'financial' | 'staff' }>> {
  // Union call order and staff snapshots, order by time
  let query = `
    select 'financial' as type, 
      s.id, s.call_order_id, s.snapshot_time, s.created_by_user_id, s.created_at
      ${includeUserInfo ? ', u.name as created_by_user_name' : ', null as created_by_user_name'}
    from call_order_snapshots s
    ${includeUserInfo ? 'left join users u on s.created_by_user_id = u.id' : ''}
    ${callOrderIds ? 'where s.call_order_id = ANY($1)' : ''}
    
    union all
    
    select 'staff' as type,
      s.id, s.call_order_id, s.snapshot_time, s.created_by_user_id, s.created_at
      ${includeUserInfo ? ', u.name as created_by_user_name' : ', null as created_by_user_name'}
    from staff_snapshots s
    ${includeUserInfo ? 'left join users u on s.created_by_user_id = u.id' : ''}
    ${callOrderIds ? 'where s.call_order_id = ANY($1)' : ''}
    
    order by snapshot_time desc
    limit $${callOrderIds ? '2' : '1'}
  `;

  const params: any[] = callOrderIds ? [callOrderIds, limit] : [limit];
  const { rows } = await db.query(query, params);

  // Fetch full details for each snapshot
  const results: Array<{ snapshot: CallOrderSnapshot | StaffSnapshot; type: 'financial' | 'staff' }> = [];

  for (const row of rows) {
    if (row.type === 'financial') {
      const snapshots = await getCallOrderHistory(db, row.call_order_id, undefined, undefined, includeUserInfo);
      const snapshot = snapshots.find((s) => s.id === row.id);
      if (snapshot) {
        results.push({ snapshot, type: 'financial' });
      }
    } else {
      const snapshots = await getStaffHistory(db, row.call_order_id, undefined, undefined, includeUserInfo);
      const snapshot = snapshots.find((s) => s.id === row.id);
      if (snapshot) {
        results.push({ snapshot, type: 'staff' });
      }
    }
  }

  return results;
}

/**
 * Get full audit log with optional filters.
 * @param db Database connection
 * @param filters Optional filters
 * @returns Array of audit log entries
 */
export async function getAuditReport(
  db: Queryable,
  filters?: {
    userId?: number;
    startDate?: string;
    endDate?: string;
    action?: string;
    entity?: string;
    entityId?: string;
  }
): Promise<AuditLogEntry[]> {
  let query = `
    select id, actor, role, action, entity, entity_id, details, occurred_at, user_id, snapshot_id, snapshot_type
    from audit_log
    where 1=1
  `;

  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.userId) {
    query += ` and user_id = $${paramIndex}`;
    params.push(filters.userId);
    paramIndex++;
  }

  if (filters?.startDate) {
    query += ` and occurred_at >= $${paramIndex}`;
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters?.endDate) {
    query += ` and occurred_at <= $${paramIndex}`;
    params.push(filters.endDate);
    paramIndex++;
  }

  if (filters?.action) {
    query += ` and action = $${paramIndex}`;
    params.push(filters.action);
    paramIndex++;
  }

  if (filters?.entity) {
    query += ` and entity = $${paramIndex}`;
    params.push(filters.entity);
    paramIndex++;
  }

  if (filters?.entityId) {
    query += ` and entity_id = $${paramIndex}`;
    params.push(filters.entityId);
    paramIndex++;
  }

  query += ` order by occurred_at desc limit 1000`;

  const { rows } = await db.query(query, params);

  return rows.map((r) => ({
    id: r.id,
    actor: r.actor,
    role: r.role,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    details: r.details,
    occurredAt: r.occurred_at.toISOString(),
    userId: r.user_id,
    snapshotId: r.snapshot_id,
    snapshotType: r.snapshot_type,
  }));
}
