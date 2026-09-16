/**
 * Authentication Service Layer
 * Core authentication utilities for password hashing, JWT management, and session handling.
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "./db.ts";

// ============================================================================
// Configuration
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-in-production";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "15m";
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

const BCRYPT_ROUNDS = 10; // Standard bcrypt cost factor

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: number;
  email: string;
  password_hash: string | null;
  name: string;
  role: "customer" | "pm" | "admin" | "program_manager";
  auth_provider: "email" | "microsoft";
  azure_oid?: string | null;
  status: "active" | "inactive" | "suspended";
  must_reset_password: boolean;
  can_lock_reports: boolean;
  last_login_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  type: "access" | "refresh";
}

// ============================================================================
// Password Management (bcrypt)
// ============================================================================

/**
 * Hash a plain-text password using bcrypt.
 * @param password - Plain-text password to hash
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a plain-text password against a bcrypt hash.
 * @param password - Plain-text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns True if password matches hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength.
 * Requirements: minimum 8 characters, at least one uppercase, one lowercase, one number, one special char.
 * @param password - Password to validate
 * @returns Object with valid flag and optional error message
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character" };
  }
  return { valid: true };
}

// ============================================================================
// JWT Token Management
// ============================================================================

/**
 * Generate a JWT access token for a user.
 * @param user - User object
 * @returns Signed JWT token
 */
export function generateAccessToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    type: "access",
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY as jwt.SignOptions["expiresIn"] });
}

/**
 * Generate a JWT refresh token for a user.
 * @param user - User object
 * @returns Signed JWT refresh token
 */
export function generateRefreshToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    type: "refresh",
  };
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"] });
}

/**
 * Verify and decode a JWT token.
 * @param token - JWT token to verify
 * @param tokenType - Expected token type (access or refresh)
 * @returns Decoded payload or null if invalid
 */
export function verifyJWT(token: string, tokenType: "access" | "refresh" = "access"): JWTPayload | null {
  try {
    const secret = tokenType === "access" ? JWT_SECRET : SESSION_SECRET;
    const payload = jwt.verify(token, secret) as JWTPayload;
    
    // Verify token type matches expected
    if (payload.type !== tokenType) {
      return null;
    }
    
    return payload;
  } catch (err) {
    // Invalid or expired token
    return null;
  }
}

// ============================================================================
// Session Management (Database-backed)
// ============================================================================

/**
 * Create a new session in the database.
 * @param userId - User ID
 * @param token - JWT refresh token
 * @returns Created session object
 */
export async function createSession(userId: number, token: string): Promise<Session> {
  // Calculate expiry based on REFRESH_TOKEN_EXPIRY
  const expiryMs = parseExpiry(REFRESH_TOKEN_EXPIRY);
  const expiresAt = new Date(Date.now() + expiryMs);
  
  // Use UPSERT to handle duplicate tokens gracefully
  // (can happen if user logs in multiple times in same second)
  const result = await pool.query<Session>(
    `insert into sessions (user_id, token, expires_at)
     values ($1, $2, $3)
     on conflict (token) do update
       set expires_at = excluded.expires_at
     returning *`,
    [userId, token, expiresAt]
  );
  
  return result.rows[0];
}

/**
 * Validate a session token against the database.
 * @param token - JWT refresh token
 * @returns Session object if valid, null if expired or not found
 */
export async function validateSession(token: string): Promise<Session | null> {
  const result = await pool.query<Session>(
    `select * from sessions
     where token = $1 and expires_at > now()`,
    [token]
  );
  
  return result.rows[0] || null;
}

/**
 * Invalidate a session (logout).
 * @param token - JWT refresh token to invalidate
 */
export async function invalidateSession(token: string): Promise<void> {
  await pool.query(
    `delete from sessions where token = $1`,
    [token]
  );
}

/**
 * Invalidate all sessions for a user (force logout from all devices).
 * @param userId - User ID
 */
export async function invalidateAllSessions(userId: number): Promise<void> {
  await pool.query(
    `delete from sessions where user_id = $1`,
    [userId]
  );
}

/**
 * Clean up expired sessions (call periodically via cron).
 */
export async function cleanupExpiredSessions(): Promise<void> {
  await pool.query(
    `delete from sessions where expires_at < now()`
  );
}

/**
 * Update user's last login timestamp.
 * @param userId - User ID
 */
export async function updateLastLogin(userId: number): Promise<void> {
  await pool.query(
    `update users set last_login_at = now() where id = $1`,
    [userId]
  );
}

// ============================================================================
// Password Reset Token Management
// ============================================================================

/**
 * Generate a secure random token for password reset.
 * @returns Random 32-byte hex string
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a password reset token in the database.
 * @param userId - User ID
 * @returns Reset token string
 */
export async function createPasswordResetToken(userId: number): Promise<string> {
  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  
  await pool.query(
    `insert into password_resets (user_id, token, expires_at)
     values ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
  
  return token;
}

// ============================================================================
// Authentication Event Logging (spec §19.4). Never exposed to customer-role users.
// ============================================================================

export type AuthEventType =
  | "magic_link_requested" | "magic_link_approved" | "magic_link_rejected"
  | "magic_link_issued" | "magic_link_used" | "magic_link_reuse_attempt"
  | "magic_link_expired_attempt" | "magic_link_invalid_attempt"
  | "sso_success" | "sso_failure" | "session_start" | "session_end";

export async function logAuthEvent(event: {
  eventType: AuthEventType;
  email?: string | null;
  userId?: number | null;
  roleAssigned?: string | null;
  ipAddress?: string | null;
  details?: unknown;
}): Promise<void> {
  await pool.query(
    `insert into authentication_events (event_type, email, user_id, role_assigned, ip_address, details)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      event.eventType,
      event.email ?? null,
      event.userId ?? null,
      event.roleAssigned ?? null,
      event.ipAddress ?? null,
      event.details === undefined ? null : JSON.stringify(event.details),
    ]
  );
}

// ============================================================================
// Magic-Link Authentication (Mission Control Slice 1, spec §19)
// ============================================================================

const MAGIC_LINK_TOKEN_EXPIRY_MINUTES = Number(process.env.MAGIC_LINK_TOKEN_EXPIRY_MINUTES) || 10;

/** Hash a magic-link token for storage. Only the hash is ever persisted (never the plaintext token). */
export function hashMagicLinkToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a single-use magic-link token for an approved user.
 * @returns The plaintext token (only returned here, to be embedded in the emailed link) and its expiry.
 */
export async function createMagicLinkToken(
  approvedUserId: number,
  requestedIp?: string | null
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashMagicLinkToken(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `insert into magic_link_tokens (approved_user_id, token_hash, expires_at, requested_ip)
     values ($1, $2, $3, $4)`,
    [approvedUserId, tokenHash, expiresAt, requestedIp || null]
  );

  return { token, expiresAt };
}

export type MagicLinkVerifyResult =
  | { outcome: "used"; approvedUserId: number }
  | { outcome: "expired" }
  | { outcome: "reused" }
  | { outcome: "invalid" };

/**
 * Verify and consume a magic-link token. Single-use: marks the token used on success so a
 * replay attempt is reported as "reused" rather than succeeding again.
 */
export async function verifyAndConsumeMagicLinkToken(token: string): Promise<MagicLinkVerifyResult> {
  const tokenHash = hashMagicLinkToken(token);

  const result = await pool.query<{ id: number; approved_user_id: number; expires_at: Date; used_at: Date | null }>(
    `select id, approved_user_id, expires_at, used_at from magic_link_tokens where token_hash = $1`,
    [tokenHash]
  );

  const row = result.rows[0];
  if (!row) return { outcome: "invalid" };
  if (row.used_at) return { outcome: "reused" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { outcome: "expired" };

  await pool.query(`update magic_link_tokens set used_at = now() where id = $1`, [row.id]);

  return { outcome: "used", approvedUserId: row.approved_user_id };
}

/**
 * Validate and consume a password reset token.
 * @param token - Reset token string
 * @returns User ID if valid, null if expired or already used
 */
export async function validatePasswordResetToken(token: string): Promise<number | null> {
  const result = await pool.query<{ user_id: number }>(
    `select user_id from password_resets
     where token = $1
       and expires_at > now()
       and used = false`,
    [token]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  // Mark token as used
  await pool.query(
    `update password_resets
     set used = true, used_at = now()
     where token = $1`,
    [token]
  );
  
  return result.rows[0].user_id;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse JWT expiry string to milliseconds.
 * @param expiry - Expiry string like "15m" or "7d"
 * @returns Milliseconds
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid expiry format: ${expiry}`);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 1000 * 60;
    case "h": return value * 1000 * 60 * 60;
    case "d": return value * 1000 * 60 * 60 * 24;
    default: throw new Error(`Unknown expiry unit: ${unit}`);
  }
}
