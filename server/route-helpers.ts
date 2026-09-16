import type express from "express";
import type pg from "pg";
import { pool, withTransaction } from "./db.ts";
import { buildSnapshot } from "./snapshot.ts";
import { actorOf } from "./auth-middleware.ts";

export type Db = pg.PoolClient;

export async function audit(db: Db, req: express.Request, action: string, entity: string, entityId: string | number | null, details?: unknown) {
  const actor = actorOf(req);
  await db.query(
    "insert into audit_log (actor, role, action, entity, entity_id, details) values ($1,$2,$3,$4,$5,$6)",
    [actor.name, actor.role, action, entity, entityId === null ? null : String(entityId), details === undefined ? null : JSON.stringify(details)],
  );
}

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
};

export const str = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

export const bool = (v: unknown): boolean => v === true || v === "true" || v === "1" || v === 1;

/** Wraps a mutation in a transaction and answers with the refreshed snapshot. */
export function mutation(fn: (db: Db, req: express.Request, res: express.Response) => Promise<boolean | void>) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const snapshot = await withTransaction(async (db) => {
        const ok = await fn(db, req, res);
        if (ok === false) return null;
        return buildSnapshot(db, req.user?.id, req.user?.role);
      });
      if (snapshot) res.json(snapshot);
    } catch (err) { next(err); }
  };
}

/** Resolves a call order route param that may be the literal "bpa" to mean the BPA-level (null) scope. */
export function callOrderIdParam(req: express.Request): string | null {
  const raw = String(req.params.callOrderId);
  return raw === "bpa" ? null : raw;
}

export async function requireScopedCallOrderAccess(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
  const callOrderId = callOrderIdParam(req);
  if (callOrderId === null) { next(); return; } // BPA-level: program_manager/admin routes already gate via requirePm et al.
  const { hasCallOrderAccess } = await import("./auth-middleware.ts");
  const hasAccess = await hasCallOrderAccess(pool, req.user!.id, req.user!.role, callOrderId);
  if (!hasAccess) {
    res.status(403).json({ error: "Access denied", message: "You do not have permission to access this call order" });
    return;
  }
  next();
}
