# Audit System Documentation

## Overview

The Contract Transparency Portal includes a comprehensive audit system that tracks all changes to call orders and staff rosters. This system provides full traceability of "who changed what, when, and why" with role-based visibility.

## Architecture

### Snapshot-Based Approach

The audit system uses **full-state snapshots** rather than deltas:

- **Advantages**:
  - Simple point-in-time queries (no need to replay deltas)
  - Guaranteed data consistency
  - Easy comparison between any two dates
  - No reconstruction logic needed

- **Storage Cost**: ~1KB per snapshot, ~1MB per year per call order (acceptable trade-off)

- **Performance**: Synchronous capture with +50ms overhead per update

## Database Schema

### call_order_snapshots

Captures the complete financial state of a call order at each change:

```sql
- id (bigserial): Unique snapshot ID
- call_order_id (text): FK to call_orders
- snapshot_time (timestamptz): When the snapshot was taken
- funded, spend, eac, over_under (numeric): Financial amounts
- pm (text): Project Manager name
- pop_start, pop_end (date): Period of performance dates
- pop_label (text): Formatted POP label
- pending (boolean): Pending status
- created_by_user_id (integer): FK to users (who made the change)
- change_reason (text): Why the change was made
- changed_fields (jsonb): Array of field names that changed
- created_at (timestamptz): Record creation timestamp
```

**Indexes**:
- `(call_order_id, snapshot_time DESC)` - For timeline queries
- `(snapshot_time DESC)` - For recent changes
- `(created_by_user_id)` - For user activity reports

### staff_snapshots

Captures the complete staff roster as a JSONB array:

```sql
- id (bigserial): Unique snapshot ID
- call_order_id (text): FK to call_orders
- snapshot_time (timestamptz): When the snapshot was taken
- staff_roster (jsonb): Full array of StaffMember objects
- created_by_user_id (integer): FK to users
- change_reason (text): Why the change was made
- change_type (text): 'add' | 'update' | 'delete'
- changed_staff_id (integer): FK to staff (which staff member changed)
- created_at (timestamptz): Record creation timestamp
```

**Indexes**: Same as call_order_snapshots

### audit_log (extended)

Existing audit_log table was extended with:

```sql
- snapshot_id (bigint): Links to snapshot tables
- snapshot_type (text): 'call_order' | 'staff'
```

## Backend Services

### snapshot-history.ts

Service for capturing snapshots:

- `captureCallOrderSnapshot(db, callOrderId, userId, reason, changedFields)` - Captures financial snapshot
- `captureStaffSnapshot(db, callOrderId, userId, changeType, changedStaffId, reason)` - Captures staff roster
- `captureFullSnapshot(db, callOrderId, userId, reason)` - Captures both financial and staff
- `linkSnapshotToAuditLog(db, auditLogId, snapshotId, snapshotType)` - Links snapshot to audit log

### history-queries.ts

Service for retrieving audit history:

- `getCallOrderHistory(db, callOrderId, startDate?, endDate?, includeUserInfo)` - Get financial timeline
- `getStaffHistory(db, callOrderId, startDate?, endDate?, includeUserInfo)` - Get staff timeline
- `getCallOrderAtDate(db, callOrderId, targetDate)` - Point-in-time query
- `compareCallOrderStates(db, callOrderId, date1, date2)` - Compare two snapshots
- `getRecentChanges(db, limit, callOrderIds?, includeUserInfo)` - Dashboard widget data
- `getAuditReport(db, filters)` - Admin audit log with filters

## API Endpoints

### History Endpoints

**GET /api/call-orders/:id/history**
- Query params: `startDate`, `endDate`
- Returns: `{ callOrderHistory: CallOrderSnapshot[], staffHistory: StaffSnapshot[] }`
- Role-based: Customers don't see `createdByUserName`

**GET /api/call-orders/:id/history/:date**
- Returns: Single snapshot at specified date
- Role-based: Customers don't see user attribution

**GET /api/call-orders/:id/history/compare?date1=X&date2=Y**
- Returns: `{ before: Snapshot, after: Snapshot, changes: [{field, before, after}] }`
- Role-based filtering applies

**GET /api/audit/recent-changes?limit=50**
- Returns: Array of recent changes across all accessible call orders
- Role-based: Filters to user's accessible call orders, hides user names for customers

**GET /api/audit/report** (Admin only)
- Query params: `userId`, `startDate`, `endDate`, `action`, `entity`, `entityId`
- Returns: Full audit log array (max 1000 entries)

## Frontend Components

### CallOrderHistory

History tab within call order detail view:

- **Timeline view**: Chronological list of all changes
- **Filter**: All changes, Financial only, People only
- **Compare mode**: Select two dates and see what changed
- **Role-based display**:
  - Customers: See what/when changed (no user names)
  - Internal users: See full audit trail with user attribution

### RecentChangesWidget

Dashboard widget showing last 20 changes:

- Displays icon (💰 financial, 👥 staff)
- Shows call order ID and change description
- Time ago display (e.g., "5m ago", "2h ago", "3d ago")
- Role-based user attribution

### AuditLogPage (Admin)

Comprehensive admin-only audit log viewer:

- **Filters**: User ID, date range, action type, entity type, entity ID
- **Export**: CSV export functionality
- **Details**: Expandable JSON details for each entry
- **Snapshot links**: Shows which snapshot is linked to each audit entry
- **Limit**: Max 1,000 most recent entries

## Role-Based Visibility

### Customers

**See**:
- ✅ What changed (amounts, dates, names, statuses)
- ✅ When changes occurred (timestamp)
- ✅ Why it changed (change reason)

**Don't see**:
- ❌ Who made the change (user name/ID)
- ❌ Which user logged in

### Project Managers, Program Managers, Admins

**See**:
- ✅ Everything customers see, PLUS:
- ✅ User attribution (who made each change)
- ✅ Full audit log with user activity

## Integration Points

Snapshots are captured automatically at these endpoints:

1. **PATCH /api/call-orders/:id/spend** - Before spend update
2. **POST /api/call-orders/:id/staff** - After staff add
3. **PATCH /api/staff/:id** - Before status update
4. **DELETE /api/staff/:id** - Before deletion
5. **POST /api/call-orders/upload** - After initial upload (future)

## Usage Examples

### View History Timeline

```typescript
// Customers see changes without user attribution
<CallOrderHistory callOrderId="Call 2.3" userRole="customer" />

// PMs see full audit trail with user names
<CallOrderHistory callOrderId="Call 2.3" userRole="pm" />
```

### Compare Two Dates

```typescript
// API call
GET /api/call-orders/Call%202.3/history/compare?date1=2024-01-01&date2=2024-06-01

// Response
{
  "before": { funded: 100000, spend: 25000, ... },
  "after": { funded: 150000, spend: 50000, ... },
  "changes": [
    { field: "funded", before: 100000, after: 150000 },
    { field: "spend", before: 25000, after: 50000 }
  ]
}
```

### Recent Changes Widget

```typescript
// Shows last 20 changes across all accessible call orders
<RecentChangesWidget userRole={user.role} />
```

### Admin Audit Report

```typescript
// Full audit log with filters
GET /api/audit/report?startDate=2024-01-01&action=call_order.spend&entity=call_order
```

## Best Practices

1. **Snapshot Reasons**: Always provide meaningful change reasons
   - Good: "Spend updated - monthly invoice processed"
   - Bad: "Update"

2. **Performance**: Snapshots add ~50ms overhead
   - Use synchronous capture to ensure consistency
   - Indexes keep query performance under 100ms

3. **Storage**: Monitor snapshot growth
   - ~1KB per snapshot
   - ~1000 snapshots/year per call order = 1MB/year
   - No automatic cleanup (forever retention)

4. **Role-Based Queries**: Always pass `includeUserInfo` parameter
   - `false` for customer-facing queries
   - `true` for internal/admin queries

5. **Error Handling**: Snapshot failures should not block operations
   - Wrap snapshot calls in try-catch
   - Log errors but continue with main operation

## Maintenance

### Manual Snapshot

If you need to capture a snapshot manually:

```typescript
import { captureFullSnapshot } from './snapshot-history.ts';
import { pool } from './db.ts';

await captureFullSnapshot(pool, 'Call 2.3', userId, 'Manual snapshot for audit');
```

### Querying Old State

To see call order state on a specific date:

```typescript
import { getCallOrderAtDate } from './history-queries.ts';

const snapshot = await getCallOrderAtDate(pool, 'Call 2.3', '2024-01-15T00:00:00Z');
console.log(`Funded on Jan 15: ${snapshot.funded}`);
```

### Rebuilding History

If snapshots are missing, they can be reconstructed from audit_log:

```sql
-- Find audit events without snapshots
SELECT * FROM audit_log 
WHERE entity = 'call_order' 
  AND snapshot_id IS NULL 
ORDER BY occurred_at;
```

## Future Enhancements

Potential improvements:

1. **Compression**: JSONB compression for staff_roster could reduce storage
2. **Retention policy**: Archive snapshots older than N years
3. **Async capture**: Move snapshot capture to background job (trade consistency for performance)
4. **Diff visualization**: Show field-by-field diffs with highlighting
5. **Restore capability**: Allow admins to restore to previous snapshot
6. **Change notifications**: Email/Slack alerts on specific changes
7. **Compliance reports**: Generate audit reports for external audits

## Security Considerations

1. **User Attribution**: Always capture `created_by_user_id`
2. **Role Enforcement**: Never expose user info to customers at API or UI level
3. **Audit Immutability**: Snapshots should never be modified or deleted
4. **Access Control**: requireCallOrderAccess middleware on history endpoints
5. **SQL Injection**: All queries use parameterized statements

## Testing

Manual test scenarios:

1. **Customer visibility**: Log in as customer, view History tab - should NOT see user names
2. **PM visibility**: Log in as PM, view History tab - should see user names
3. **Timeline ordering**: Make several changes, verify they appear in correct order
4. **Compare mode**: Select two dates, verify differences are calculated correctly
5. **Recent changes**: Make change, check dashboard widget updates
6. **Admin audit log**: Use filters, verify correct entries returned
7. **Export**: Download CSV, verify format and content

## Troubleshooting

### Snapshots not appearing

Check:
1. Database has snapshot tables: `\d call_order_snapshots`
2. Snapshots are being created: `SELECT count(*) FROM call_order_snapshots`
3. API endpoint authentication is working
4. Frontend is passing correct role

### Performance issues

Check:
1. Indexes exist: `\d call_order_snapshots` (should show 3 indexes)
2. Query uses indexed columns: `EXPLAIN ANALYZE SELECT ...`
3. Snapshot table size: `SELECT pg_size_pretty(pg_total_relation_size('call_order_snapshots'))`

### Role-based filtering not working

Check:
1. API passes `includeUserInfo` parameter correctly
2. Frontend passes `userRole` prop to components
3. Response filtering logic in components
