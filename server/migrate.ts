import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./db.ts";

const here = dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  const sql = readFileSync(join(here, "schema.sql"), "utf8");
  await pool.query(sql);
}

if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  migrate()
    .then(() => { console.log("Schema applied."); return pool.end(); })
    .catch((err) => { console.error(err); process.exit(1); });
}
