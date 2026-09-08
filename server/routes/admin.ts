/**
 * Admin routes for user management.
 * Admins have full access. Program Managers can only manage customers.
 */

import express from "express";
import { pool } from "../db.ts";
import { authenticateRequest, requireAdmin, requireAdminOrProgramManager } from "../auth-middleware.ts";
import { hashPassword, validatePassword } from "../auth-service.ts";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateRequest);

// Rate limiter for user creation
const createUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 users per 15 minutes
  message: { error: "Too many user creation requests, please try again later" },
});

interface User {
  id: number;
  email: string;
  name: string;
  role: "customer" | "pm" | "admin" | "program_manager";
  auth_provider: "email" | "microsoft";
  azure_oid: string | null;
  status: "active" | "inactive" | "suspended";
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/admin/users
 * List all users with optional filtering.
 * Program Managers can only see customers.
 */
router.get("/users", requireAdminOrProgramManager, async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const isProgramManager = req.user!.role === "program_manager";

    let query = "SELECT id, email, name, role, auth_provider, azure_oid, status, must_reset_password, last_login_at, created_at, updated_at FROM users WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    // Program Managers can only see customers
    if (isProgramManager) {
      query += ` AND role = 'customer'`;
    }

    if (role && !isProgramManager) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search && typeof search === "string") {
      query += ` AND (lower(name) LIKE $${paramIndex} OR lower(email) LIKE $${paramIndex})`;
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query<User>(query, params);

    res.json({
      users: result.rows,
      total: result.rows.length,
      canManageAllRoles: !isProgramManager, // Frontend uses this to show/hide role options
    });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({
      error: "Failed to list users",
      message: "An error occurred while fetching users",
    });
  }
});

/**
 * GET /api/admin/users/:id
 * Get a specific user by ID.
 */
router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query<User>(
      "SELECT id, email, name, role, auth_provider, azure_oid, status, last_login_at, created_at, updated_at FROM users WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: "User not found",
        message: "No user found with the specified ID",
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      error: "Failed to get user",
      message: "An error occurred while fetching the user",
    });
  }
});

/**
 * POST /api/admin/users
 * Create a new user.
 * Admins can create any role. Program Managers can only create customers.
 */
router.post("/users", requireAdminOrProgramManager, createUserLimiter, async (req, res) => {
  try {
    const { email, name, role, password, auth_provider } = req.body;
    const isProgramManager = req.user!.role === "program_manager";

    // Validate required fields
    if (!email || !name || !role) {
      res.status(400).json({
        error: "Missing required fields",
        message: "Email, name, and role are required",
      });
      return;
    }

    // Program Managers can only create customers
    if (isProgramManager && role !== "customer") {
      res.status(403).json({
        error: "Insufficient permissions",
        message: "Program Managers can only create customer accounts",
      });
      return;
    }

    // Validate role
    if (!["customer", "pm", "admin", "program_manager"].includes(role)) {
      res.status(400).json({
        error: "Invalid role",
        message: "Role must be customer, pm, admin, or program_manager",
      });
      return;
    }

    // Default to email auth for customers created by program managers
    const finalAuthProvider = auth_provider || (isProgramManager ? "email" : undefined);
    
    if (!finalAuthProvider) {
      res.status(400).json({
        error: "Missing auth provider",
        message: "Auth provider is required",
      });
      return;
    }

    // Validate auth provider
    if (!["email", "microsoft"].includes(finalAuthProvider)) {
      res.status(400).json({
        error: "Invalid auth provider",
        message: "Auth provider must be email or microsoft",
      });
      return;
    }

    // Handle password: generate temporary for PM-created customers, or use provided password
    let passwordHash = null;
    let temporaryPassword: string | null = null;
    let mustResetPassword = false;

    if (finalAuthProvider === "email") {
      if (isProgramManager) {
        // Generate temporary password for customers created by program managers
        temporaryPassword = crypto.randomBytes(8).toString("base64").slice(0, 12) + "!Aa1";
        passwordHash = await hashPassword(temporaryPassword);
        mustResetPassword = true;
      } else {
        // Admin-created users: password required and must be valid
        if (!password) {
          res.status(400).json({
            error: "Password required",
            message: "Password is required for email authentication",
          });
          return;
        }

        const validation = validatePassword(password);
        if (!validation.valid) {
          res.status(400).json({
            error: "Invalid password",
            message: validation.message,
          });
          return;
        }

        passwordHash = await hashPassword(password);
      }
    }

    // Check if email already exists
    const existing = await pool.query("SELECT id FROM users WHERE lower(email) = lower($1)", [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({
        error: "Email already exists",
        message: "A user with this email address already exists",
      });
      return;
    }

    // Create user
    const result = await pool.query<User>(
      `INSERT INTO users (email, password_hash, name, role, auth_provider, status, must_reset_password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, now(), now())
       RETURNING id, email, name, role, auth_provider, status, must_reset_password, created_at, updated_at`,
      [email, passwordHash, name, role, finalAuthProvider, mustResetPassword]
    );

    res.status(201).json({
      message: "User created successfully",
      user: result.rows[0],
      temporaryPassword: temporaryPassword, // Only sent when PM creates customer
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      error: "Failed to create user",
      message: "An error occurred while creating the user",
    });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Update a user's details (admin action).
 */
router.patch("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, status } = req.body;

    // Validate at least one field to update
    if (!name && !role && !status) {
      res.status(400).json({
        error: "No fields to update",
        message: "Provide at least one field to update (name, role, or status)",
      });
      return;
    }

    // Validate role if provided
    if (role && !["customer", "pm", "admin", "program_manager"].includes(role)) {
      res.status(400).json({
        error: "Invalid role",
        message: "Role must be customer, pm, admin, or program_manager",
      });
      return;
    }

    // Validate status if provided
    if (status && !["active", "inactive", "suspended"].includes(status)) {
      res.status(400).json({
        error: "Invalid status",
        message: "Status must be active, inactive, or suspended",
      });
      return;
    }

    // Check user exists
    const existing = await pool.query("SELECT id FROM users WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({
        error: "User not found",
        message: "No user found with the specified ID",
      });
      return;
    }

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }

    if (role) {
      updates.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (status) {
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    updates.push(`updated_at = now()`);
    params.push(id);

    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING id, email, name, role, auth_provider, status, created_at, updated_at`;

    const result = await pool.query<User>(query, params);

    res.json({
      message: "User updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      error: "Failed to update user",
      message: "An error occurred while updating the user",
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user (admin action).
 */
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;

    // Prevent admin from deleting themselves
    if (parseInt(id) === adminId) {
      res.status(400).json({
        error: "Cannot delete yourself",
        message: "You cannot delete your own account",
      });
      return;
    }

    // Check user exists
    const existing = await pool.query("SELECT id FROM users WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({
        error: "User not found",
        message: "No user found with the specified ID",
      });
      return;
    }

    // Delete user (cascade will handle sessions, etc.)
    await pool.query("DELETE FROM users WHERE id = $1", [id]);

    res.json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      error: "Failed to delete user",
      message: "An error occurred while deleting the user",
    });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Reset a user's password (admin action, email auth only).
 */
router.post("/users/:id/reset-password", async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    // Validate password
    if (!password) {
      res.status(400).json({
        error: "Password required",
        message: "New password is required",
      });
      return;
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      res.status(400).json({
        error: "Invalid password",
        message: validation.message,
      });
      return;
    }

    // Check user exists and uses email auth
    const userResult = await pool.query<User>(
      "SELECT id, auth_provider FROM users WHERE id = $1",
      [id]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({
        error: "User not found",
        message: "No user found with the specified ID",
      });
      return;
    }

    const user = userResult.rows[0];

    if (user.auth_provider !== "email") {
      res.status(400).json({
        error: "Invalid operation",
        message: "Can only reset password for email-authenticated users",
      });
      return;
    }

    // Hash and update password
    const passwordHash = await hashPassword(password);
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2",
      [passwordHash, id]
    );

    // Invalidate all sessions for this user
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [id]);

    res.json({
      message: "Password reset successfully. User must log in again.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      error: "Failed to reset password",
      message: "An error occurred while resetting the password",
    });
  }
});

// ============================================================================
// Call Order Assignment Management
// ============================================================================

/**
 * GET /api/admin/call-orders
 * List all call orders (for assignment UI).
 */
router.get("/call-orders", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, group_name, pm, pending 
       FROM call_orders 
       WHERE NOT pending 
       ORDER BY sort_order, created_at`
    );

    res.json({
      callOrders: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("List call orders error:", error);
    res.status(500).json({
      error: "Failed to list call orders",
      message: "An error occurred while fetching call orders",
    });
  }
});

/**
 * GET /api/admin/users/:id/call-orders
 * List call orders assigned to a specific user.
 */
router.get("/users/:id/call-orders", async (req, res) => {
  try {
    const { id } = req.params;

    // Verify user exists
    const userCheck = await pool.query("SELECT id, role FROM users WHERE id = $1", [id]);
    if (userCheck.rows.length === 0) {
      res.status(404).json({
        error: "User not found",
        message: "No user found with the specified ID",
      });
      return;
    }

    const user = userCheck.rows[0];

    // If user is Program Manager or admin, they have access to all call orders
    if (user.role === "program_manager" || user.role === "admin") {
      res.json({
        userId: parseInt(id),
        role: user.role,
        hasFullAccess: true,
        assignments: [],
        message: "Program Managers and admins have access to all call orders",
      });
      return;
    }

    // For customers and PMs, get their assignments
    const result = await pool.query(
      `SELECT uco.call_order_id, co.name as call_order_name, co.group_name, uco.created_at as assigned_at
       FROM user_call_orders uco
       JOIN call_orders co ON co.id = uco.call_order_id
       WHERE uco.user_id = $1
       ORDER BY co.sort_order, co.created_at`,
      [id]
    );

    res.json({
      userId: parseInt(id),
      role: user.role,
      hasFullAccess: false,
      assignments: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("List user call orders error:", error);
    res.status(500).json({
      error: "Failed to list user call orders",
      message: "An error occurred while fetching user call order assignments",
    });
  }
});

/**
 * POST /api/admin/users/:id/call-orders
 * Assign a user to a call order.
 */
router.post("/users/:id/call-orders", async (req, res) => {
  try {
    const { id } = req.params;
    const { callOrderId } = req.body;

    // Validate input
    if (!callOrderId) {
      res.status(400).json({
        error: "Missing call order ID",
        message: "Call order ID is required",
      });
      return;
    }

    // Verify user exists
    const userCheck = await pool.query("SELECT id, role FROM users WHERE id = $1", [id]);
    if (userCheck.rows.length === 0) {
      res.status(404).json({
        error: "User not found",
        message: "No user found with the specified ID",
      });
      return;
    }

    const user = userCheck.rows[0];

    // Don't allow assigning Program Managers or admins (they have full access already)
    if (user.role === "program_manager" || user.role === "admin") {
      res.status(400).json({
        error: "Invalid operation",
        message: "Program Managers and admins automatically have access to all call orders",
      });
      return;
    }

    // Verify call order exists
    const callOrderCheck = await pool.query("SELECT id FROM call_orders WHERE id = $1", [callOrderId]);
    if (callOrderCheck.rows.length === 0) {
      res.status(404).json({
        error: "Call order not found",
        message: "No call order found with the specified ID",
      });
      return;
    }

    // Insert assignment (on conflict do nothing for idempotency)
    await pool.query(
      `INSERT INTO user_call_orders (user_id, call_order_id, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id, call_order_id) DO NOTHING`,
      [id, callOrderId]
    );

    res.status(201).json({
      message: "User assigned to call order successfully",
      userId: parseInt(id),
      callOrderId,
    });
  } catch (error) {
    console.error("Assign user to call order error:", error);
    res.status(500).json({
      error: "Failed to assign user to call order",
      message: "An error occurred while creating the assignment",
    });
  }
});

/**
 * DELETE /api/admin/users/:id/call-orders/:callOrderId
 * Remove a user's assignment to a call order.
 */
router.delete("/users/:id/call-orders/:callOrderId", async (req, res) => {
  try {
    const { id, callOrderId } = req.params;

    // Verify user exists
    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [id]);
    if (userCheck.rows.length === 0) {
      res.status(404).json({
        error: "User not found",
        message: "No user found with the specified ID",
      });
      return;
    }

    // Delete assignment
    const result = await pool.query(
      "DELETE FROM user_call_orders WHERE user_id = $1 AND call_order_id = $2",
      [id, callOrderId]
    );

    // Check if assignment existed
    if (result.rowCount === 0) {
      res.status(404).json({
        error: "Assignment not found",
        message: "No assignment found for this user and call order",
      });
      return;
    }

    res.json({
      message: "Assignment removed successfully",
      userId: parseInt(id),
      callOrderId,
    });
  } catch (error) {
    console.error("Remove user call order assignment error:", error);
    res.status(500).json({
      error: "Failed to remove assignment",
      message: "An error occurred while removing the assignment",
    });
  }
});

export default router;
