import pg from "pg";

const PAUL_EMAIL = "paul.schomburg@techsur.com";
const JESSICA_EMAIL = "jessica.delasalle@techsur.com";
const apply = process.argv.includes("--apply");

interface AccessRecord {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  can_lock_reports: boolean;
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required; refusing to guess which database should be changed.");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function loadUser(email: string): Promise<AccessRecord> {
  const { rows } = await pool.query<AccessRecord>(
    `select id, name, email, role, status, coalesce(can_lock_reports, false) as can_lock_reports
       from users
      where lower(email) = lower($1)`,
    [email],
  );
  if (rows.length !== 1) throw new Error(`Expected exactly one user for ${email}; found ${rows.length}.`);
  return rows[0];
}

async function main(): Promise<void> {
  const paul = await loadUser(PAUL_EMAIL);
  const jessica = await loadUser(JESSICA_EMAIL);

  if (paul.role !== "program_manager") {
    throw new Error(`Safety check failed: Paul currently has role ${paul.role}, not program_manager.`);
  }
  if (paul.status !== "active" || jessica.status !== "active") {
    throw new Error("Safety check failed: both Paul and Jessica must have active accounts.");
  }

  console.log("Current access:");
  console.table([
    { user: paul.name, role: paul.role, canLockReports: paul.can_lock_reports },
    { user: jessica.name, role: jessica.role, canLockReports: jessica.can_lock_reports },
  ]);

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to give Jessica Paul's role and explicit report-lock setting.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<AccessRecord>(
      `update users
          set role = $2, can_lock_reports = $3, updated_at = now()
        where id = $1
        returning id, name, email, role, status, coalesce(can_lock_reports, false) as can_lock_reports`,
      [jessica.id, paul.role, paul.can_lock_reports],
    );

    // Keep a future magic-link provisioning record consistent when one exists.
    await client.query(
      `update approved_users
          set role = $2, updated_at = now()
        where lower(email) = lower($1)`,
      [JESSICA_EMAIL, paul.role],
    );

    await client.query(
      `insert into audit_log (actor, role, action, entity, entity_id, details)
       values ($1, 'admin', 'user.access.match', 'user', $2, $3::jsonb)`,
      [
        "Jessica access promotion script",
        String(jessica.id),
        JSON.stringify({
          sourceUserId: paul.id,
          sourceEmail: paul.email,
          previousRole: jessica.role,
          newRole: paul.role,
          previousCanLockReports: jessica.can_lock_reports,
          newCanLockReports: paul.can_lock_reports,
        }),
      ],
    );
    await client.query("commit");

    console.log("\nAccess updated:");
    console.table(rows.map((row) => ({
      user: row.name,
      role: row.role,
      canLockReports: row.can_lock_reports,
    })));
    console.log("Jessica now receives full call-order access through the program_manager role. Refresh or sign in again to update the UI.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
