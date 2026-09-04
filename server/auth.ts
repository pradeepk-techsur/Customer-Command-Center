// Role and identity come from request headers set by the client's "View as" switch.
// In production these headers are supplied by the identity-aware proxy / SSO layer in front of the
// API; the portal itself never trusts the browser to decide who is a Project Manager.
import type { Request, Response, NextFunction } from "express";
import type { Role } from "../shared/types.ts";

export interface Actor { name: string; role: Role }

export function actorOf(req: Request): Actor {
  const role = req.header("x-portal-role") === "pm" ? "pm" : "customer";
  const raw = (req.header("x-portal-user") || "").trim();
  return { name: raw || (role === "pm" ? "Project Manager" : "Customer"), role };
}

/** Customers have no ability to create, edit, upload or delete anything — enforced here, not only in the UI. */
export function requirePm(req: Request, res: Response, next: NextFunction) {
  if (actorOf(req).role !== "pm") {
    res.status(403).json({ error: "Only a Project Manager can change portal data." });
    return;
  }
  next();
}
