/**
 * Authentication Middleware
 * JWT-based authentication replacing mock header-based auth.
 */

import type { Request, Response, NextFunction } from "express";
import type { Role } from "../shared/types.ts";
import { verifyJWT, type User, type JWTPayload } from "./auth-service.ts";
import { pool } from "./db.ts";

// ============================================================================
// Types
// ============================================================================

export interface Actor { 
  name: string; 
  role: Role;
  userId?: number;  // Added for database linking
}

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      actor?: Actor;
    }
  }
}

// ============================================================================
// Authentication Middleware
// ============================================================================

/**
 * Extract and validate JWT token from Authorization header.
 * If valid, attach user to req.user and actor to req.actor.
 * If invalid/missing, returns 401 Unauthorized.
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ 
        error: "Authentication required",
        message: "Missing or invalid Authorization header. Expected: Bearer <token>" 
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify JWT token
    const payload = verifyJWT(token, "access");
    if (!payload) {
      res.status(401).json({ 
        error: "Invalid token",
        message: "Token is invalid, expired, or malformed" 
      });
      return;
    }

    // Fetch user from database
    const result = await pool.query<User>(
      `select * from users where id = $1 and status = 'active'`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ 
        error: "User not found or inactive",
        message: "User account may have been deactivated" 
      });
      return;
    }

    const user = result.rows[0];

    // Attach user and actor to request
    req.user = user;
    req.actor = {
      name: user.name,
      role: user.role as Role,
      userId: user.id,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ 
      error: "Authentication failed",
      message: "Internal server error during authentication" 
    });
  }
}

/**
 * Optional authentication - allows both authenticated and anonymous requests.
 * If token present and valid, attaches user. Otherwise continues without user.
 * Used for endpoints that support both modes (e.g., public views with enhanced data for authenticated users).
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.header("Authorization");
  
  // No token = continue as anonymous
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  try {
    const token = authHeader.substring(7);
    const payload = verifyJWT(token, "access");
    
    if (payload) {
      const result = await pool.query<User>(
        `select * from users where id = $1 and status = 'active'`,
        [payload.userId]
      );

      if (result.rows.length > 0) {
        const user = result.rows[0];
        req.user = user;
        req.actor = {
          name: user.name,
          role: user.role as Role,
          userId: user.id,
        };
      }
    }
  } catch (error) {
    // Silently continue as anonymous if token validation fails
    console.warn("Optional auth failed, continuing as anonymous:", error);
  }

  next();
}

// ============================================================================
// Role-Based Authorization Middleware
// ============================================================================

/**
 * Require Project Manager role (pm or program_manager).
 * Must be used AFTER authenticateRequest middleware.
 * Customers have no ability to create, edit, upload or delete anything.
 */
export function requirePm(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ 
      error: "Authentication required",
      message: "Must be authenticated to perform this action" 
    });
    return;
  }

  if (req.user.role !== "pm" && req.user.role !== "program_manager" && req.user.role !== "admin") {
    res.status(403).json({ 
      error: "Insufficient permissions",
      message: "Only Project Managers can modify portal data" 
    });
    return;
  }

  next();
}

/**
 * Require Program Manager role (program_manager only).
 * Must be used AFTER authenticateRequest middleware.
 * Program Managers have full access - they can view all call orders and manage monthly reports.
 */
export function requireProgramManager(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ 
      error: "Authentication required",
      message: "Must be authenticated to perform this action" 
    });
    return;
  }

  if (req.user.role !== "program_manager" && req.user.role !== "admin") {
    res.status(403).json({ 
      error: "Insufficient permissions",
      message: "Only Program Managers can perform this operation" 
    });
    return;
  }

  next();
}

/**
 * Require Administrator role.
 * Must be used AFTER authenticateRequest middleware.
 * Only admins can manage users, view audit logs, etc.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ 
      error: "Authentication required",
      message: "Must be authenticated to perform this action" 
    });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({ 
      error: "Insufficient permissions",
      message: "Only Administrators can access this resource" 
    });
    return;
  }

  next();
}

/**
 * Require Administrator or Program Manager role.
 * Must be used AFTER authenticateRequest middleware.
 * Program Managers can manage customers, admins can manage all users.
 */
export function requireAdminOrProgramManager(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ 
      error: "Authentication required",
      message: "Must be authenticated to perform this action" 
    });
    return;
  }

  if (req.user.role !== "admin" && req.user.role !== "program_manager") {
    res.status(403).json({ 
      error: "Insufficient permissions",
      message: "Only Administrators and Program Managers can access this resource" 
    });
    return;
  }

  next();
}

/**
 * Require either PM, Program Manager, or Admin role.
 * Shorthand for routes that both PMs, Program Managers, and admins can access.
 */
export function requirePmOrAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ 
      error: "Authentication required",
      message: "Must be authenticated to perform this action" 
    });
    return;
  }

  if (req.user.role !== "pm" && req.user.role !== "program_manager" && req.user.role !== "admin") {
    res.status(403).json({ 
      error: "Insufficient permissions",
      message: "Only Project Managers and Administrators can access this resource" 
    });
    return;
  }

  next();
}

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * Extract actor from request.
 * For backward compatibility with existing audit logging.
 * Now uses authenticated user if available, falls back to anonymous.
 */
export function actorOf(req: Request): Actor {
  // Use authenticated user if available
  if (req.actor) {
    return req.actor;
  }

  // Default anonymous actor (should not occur with proper authentication)
  return { 
    name: "Anonymous", 
    role: "customer" 
  };
}

// ============================================================================
// Call Order Access Control
// ============================================================================

/**
 * Check if user has access to a specific call order.
 * Logic:
 * - Admins and Program Managers: Always have access to all call orders
 * - PMs and Customers: Only have access if assigned in user_call_orders table
 * 
 * @param db - Database pool or client
 * @param userId - User ID to check
 * @param userRole - User's role
 * @param callOrderId - Call order ID to check access for
 * @returns true if user has access, false otherwise
 */
export async function hasCallOrderAccess(
  db: import("./db.ts").Queryable,
  userId: number,
  userRole: string,
  callOrderId: string
): Promise<boolean> {
  // Program Managers and admins always have access to all call orders
  if (userRole === "program_manager" || userRole === "admin") {
    return true;
  }

  // For customers and PMs: check user_call_orders table
  const result = await db.query(
    `select 1 from user_call_orders 
     where user_id = $1 and call_order_id = $2 
     limit 1`,
    [userId, callOrderId]
  );

  return result.rows.length > 0;
}

/**
 * Get all call order IDs accessible to a user.
 * Logic:
 * - Admins and Program Managers: Return all call order IDs
 * - PMs and Customers: Return only assigned call order IDs
 * 
 * @param db - Database pool or client
 * @param userId - User ID to check
 * @param userRole - User's role
 * @returns Array of call order IDs the user can access
 */
export async function getAccessibleCallOrders(
  db: import("./db.ts").Queryable,
  userId: number,
  userRole: string
): Promise<string[]> {
  // Program Managers and admins have access to all call orders
  if (userRole === "program_manager" || userRole === "admin") {
    const result = await db.query<{ id: string }>(
      `select id from call_orders where not pending order by sort_order`
    );
    return result.rows.map(r => r.id);
  }

  // For customers and PMs: get assigned call orders
  const result = await db.query<{ call_order_id: string }>(
    `select call_order_id from user_call_orders where user_id = $1`,
    [userId]
  );
  
  return result.rows.map(r => r.call_order_id);
}

/**
 * Express middleware to require access to a call order.
 * Expects call order ID in req.params.id.
 * Requires authenticateRequest to run first.
 */
export async function requireCallOrderAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      res.status(401).json({
        error: "Authentication required",
        message: "You must be logged in to access this resource",
      });
      return;
    }

    const callOrderId = req.params.id;
    if (!callOrderId) {
      res.status(400).json({
        error: "Missing call order ID",
        message: "Call order ID is required",
      });
      return;
    }

    // Check access
    const hasAccess = await hasCallOrderAccess(
      pool,
      req.user.id,
      req.user.role,
      callOrderId
    );

    if (!hasAccess) {
      res.status(403).json({
        error: "Access denied",
        message: "You do not have permission to access this call order",
      });
      return;
    }

    next();
  } catch (error) {
    console.error("Call order access check error:", error);
    res.status(500).json({
      error: "Access check failed",
      message: "Failed to verify call order access",
    });
  }
}
