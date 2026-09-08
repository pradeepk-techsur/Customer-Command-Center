import pg from "pg";

const { Pool, types } = pg;

// Return NUMERIC as JS numbers (money in this app fits comfortably in a double) and
// DATE as the plain "YYYY-MM-DD" string so no timezone shifting happens.
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(1082, (v) => v);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/contract_portal",
});

export type Queryable = pg.Pool | pg.PoolClient;

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// Call Order Access Control Helpers
// ============================================================================

/**
 * Get list of call order IDs accessible to a user.
 * Returns:
 * - For admins/PMs: null (meaning "all call orders")
 * - For customers: array of call order IDs from user_call_orders table
 * 
 * @param db - Database pool or client
 * @param userId - User ID to check
 * @param userRole - User's role
 * @returns Array of call order IDs or null for full access
 */
export async function getAccessibleCallOrders(
  db: Queryable,
  userId: number,
  userRole: string
): Promise<string[] | null> {
  // Program Managers, admins, and customers have access to all call orders
  if (userRole === "program_manager" || userRole === "admin" || userRole === "customer") {
    return null;
  }

  // For PMs: get assigned call orders
  const result = await db.query<{ call_order_id: string }>(
    `select call_order_id from user_call_orders where user_id = $1`,
    [userId]
  );

  return result.rows.map(row => row.call_order_id);
}
