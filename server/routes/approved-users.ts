/**
 * Approved-user allowlist management (magic-link sign-in). Per spec decision #4,
 * Paul, Aidan, and Jessica (pm + program_manager + admin) can all manage this list.
 */

import express from "express";
import { pool } from "../db.ts";
import { authenticateRequest, requirePm } from "../auth-middleware.ts";
import { audit } from "../route-helpers.ts";

const router = express.Router();
router.use(authenticateRequest, requirePm);

const ROLES = ["customer", "pm", "program_manager"];

router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select * from approved_users order by status, lower(name)`
    );
    res.json({
      approvedUsers: rows.map((r) => ({
        id: r.id, email: r.email, name: r.name, role: r.role,
        addedByUserId: r.added_by_user_id, status: r.status,
        createdAt: r.created_at, updatedAt: r.updated_at,
      })),
    });
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const name = String(req.body?.name || "").trim();
    const role = String(req.body?.role || "customer");

    if (!email || !name) {
      res.status(400).json({ error: "Email and name are required." });
      return;
    }
    if (!ROLES.includes(role)) {
      res.status(400).json({ error: "Role must be customer, pm, or program_manager." });
      return;
    }

    const existing = await pool.query(`select id from approved_users where lower(email) = $1`, [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "This email is already on the approved-user list." });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rows } = await client.query(
        `insert into approved_users (email, name, role, added_by_user_id)
         values ($1, $2, $3, $4) returning *`,
        [email, name, role, req.user!.id]
      );
      await audit(client, req, "approved_user.create", "approved_user", rows[0].id, { email, role });
      await client.query("commit");
      res.status(201).json({ approvedUser: rows[0] });
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { rows: existingRows } = await pool.query(`select * from approved_users where id = $1`, [req.params.id]);
    const existing = existingRows[0];
    if (!existing) { res.status(404).json({ error: "Approved user not found." }); return; }

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
    const role = req.body?.role !== undefined ? String(req.body.role) : existing.role;
    const status = req.body?.status !== undefined ? String(req.body.status) : existing.status;

    if (!ROLES.includes(role)) { res.status(400).json({ error: "Invalid role." }); return; }
    if (!["active", "revoked"].includes(status)) { res.status(400).json({ error: "Invalid status." }); return; }

    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rows } = await client.query(
        `update approved_users set name = $2, role = $3, status = $4, updated_at = now() where id = $1 returning *`,
        [existing.id, name, role, status]
      );
      await audit(client, req, "approved_user.update", "approved_user", existing.id, { name, role, status });
      await client.query("commit");
      res.json({ approvedUser: rows[0] });
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rows } = await client.query(`delete from approved_users where id = $1 returning *`, [req.params.id]);
      if (!rows[0]) { await client.query("rollback"); res.status(404).json({ error: "Approved user not found." }); return; }
      await audit(client, req, "approved_user.delete", "approved_user", rows[0].id, { email: rows[0].email });
      await client.query("commit");
      res.status(204).end();
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

export default router;
