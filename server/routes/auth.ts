/**
 * Authentication API Routes
 * Handles login, registration, password resets, and Microsoft OAuth.
 */

import express from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { pool } from "../db.ts";
import { authenticateRequest } from "../auth-middleware.ts";
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyJWT,
  createSession,
  validateSession,
  invalidateSession,
  invalidateAllSessions,
  updateLastLogin,
  createPasswordResetToken,
  validatePasswordResetToken,
  type User,
} from "../auth-service.ts";
import {
  getAuthCodeUrl,
  handleCallback,
  getOrCreateUser,
  isAzureConfigured,
} from "../azure-auth.ts";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../email-service.ts";

const router = express.Router();

// ============================================================================
// Rate Limiting
// ============================================================================

// Login rate limiting: 5 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts", message: "Please try again in 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset request: 3 attempts per hour
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Too many password reset requests", message: "Please try again in 1 hour" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registration: 3 attempts per hour
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Too many registration attempts", message: "Please try again in 1 hour" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// Registration & Login (Email/Password)
// ============================================================================

/**
 * POST /api/auth/register
 * Register a new customer account with email/password.
 * Only customers can self-register. PM accounts must be created by admins.
 */
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      res.status(400).json({
        error: "Missing required fields",
        message: "Email, password, and name are required",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: "Invalid email",
        message: "Please provide a valid email address",
      });
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({
        error: "Weak password",
        message: passwordValidation.error,
      });
      return;
    }

    // Check if user already exists
    const existing = await pool.query(
      `select id from users where lower(email) = lower($1)`,
      [email]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({
        error: "Email already registered",
        message: "An account with this email already exists",
      });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user (customers only via self-registration)
    const result = await pool.query<User>(
      `insert into users (email, password_hash, name, role, auth_provider, status)
       values ($1, $2, $3, 'customer', 'email', 'active')
       returning *`,
      [email.toLowerCase(), passwordHash, name]
    );

    const user = result.rows[0];

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Create session
    await createSession(user.id, refreshToken);

    // Update last login
    await updateLastLogin(user.id);

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email, user.name).catch((err) =>
      console.error("Failed to send welcome email:", err)
    );

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: "Registration failed",
      message: "An error occurred during registration",
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password.
 */
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        error: "Missing credentials",
        message: "Email and password are required",
      });
      return;
    }

    // Find user by email
    const result = await pool.query<User>(
      `select * from users where lower(email) = lower($1)`,
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        error: "Invalid credentials",
        message: "Email or password is incorrect",
      });
      return;
    }

    const user = result.rows[0];

    // Check if user uses email/password authentication
    if (user.auth_provider !== "email") {
      res.status(400).json({
        error: "Wrong authentication method",
        message: "This account uses Microsoft authentication. Please sign in with Microsoft.",
      });
      return;
    }

    // Check if account is active
    if (user.status !== "active") {
      res.status(403).json({
        error: "Account inactive",
        message: `Your account is ${user.status}. Please contact support.`,
      });
      return;
    }

    // Verify password
    if (!user.password_hash) {
      res.status(500).json({
        error: "Account misconfigured",
        message: "Password not set for this account",
      });
      return;
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({
        error: "Invalid credentials",
        message: "Email or password is incorrect",
      });
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Create session
    await createSession(user.id, refreshToken);

    // Update last login
    await updateLastLogin(user.id);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustResetPassword: user.must_reset_password || false,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Login failed",
      message: "An error occurred during login",
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change password (for first-time login or user-initiated change).
 */
router.post("/change-password", authenticateRequest, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      res.status(400).json({
        error: "Missing required fields",
        message: "Current password and new password are required",
      });
      return;
    }

    // Get user from database
    const result = await pool.query<User>(
      `select * from users where id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: "User not found",
        message: "User account not found",
      });
      return;
    }

    const user = result.rows[0];

    // Verify email auth provider
    if (user.auth_provider !== "email") {
      res.status(400).json({
        error: "Cannot change password",
        message: "This account uses Microsoft authentication",
      });
      return;
    }

    // Verify current password
    if (!user.password_hash) {
      res.status(500).json({
        error: "Account misconfigured",
        message: "Password not set for this account",
      });
      return;
    }

    const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({
        error: "Invalid password",
        message: "Current password is incorrect",
      });
      return;
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      res.status(400).json({
        error: "Invalid password",
        message: validation.message,
      });
      return;
    }

    // Hash and update password
    const newPasswordHash = await hashPassword(newPassword);
    await pool.query(
      `update users set password_hash = $1, must_reset_password = false, updated_at = now() where id = $2`,
      [newPasswordHash, userId]
    );

    res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      error: "Password change failed",
      message: "An error occurred while changing the password",
    });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate current session.
 */
router.post("/logout", authenticateRequest, async (req, res) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      res.status(400).json({ error: "No token provided" });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Try to parse as refresh token to invalidate session
    const payload = verifyJWT(token, "refresh");
    if (payload) {
      await invalidateSession(token);
    }

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      error: "Logout failed",
      message: "An error occurred during logout",
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user.
 */
router.get("/me", authenticateRequest, (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    auth_provider: req.user.auth_provider,
    last_login_at: req.user.last_login_at,
    created_at: req.user.created_at,
  });
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token.
 */
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        error: "Missing refresh token",
        message: "Refresh token is required",
      });
      return;
    }

    // Validate refresh token
    const payload = verifyJWT(refreshToken, "refresh");
    if (!payload) {
      res.status(401).json({
        error: "Invalid refresh token",
        message: "Token is invalid or expired",
      });
      return;
    }

    // Validate session exists in database
    const session = await validateSession(refreshToken);
    if (!session) {
      res.status(401).json({
        error: "Session not found",
        message: "Session has been invalidated",
      });
      return;
    }

    // Fetch user
    const result = await pool.query<User>(
      `select * from users where id = $1 and status = 'active'`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        error: "User not found",
        message: "User account no longer exists or is inactive",
      });
      return;
    }

    const user = result.rows[0];

    // Generate new access token
    const accessToken = generateAccessToken(user);

    res.json({ accessToken });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({
      error: "Token refresh failed",
      message: "An error occurred while refreshing token",
    });
  }
});

// ============================================================================
// Password Reset
// ============================================================================

/**
 * POST /api/auth/password-reset/request
 * Request password reset email.
 */
router.post("/password-reset/request", resetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        error: "Missing email",
        message: "Email address is required",
      });
      return;
    }

    // Find user
    const result = await pool.query<User>(
      `select * from users where lower(email) = lower($1)`,
      [email]
    );

    // Always return success even if email not found (security best practice)
    if (result.rows.length === 0) {
      res.json({
        message: "If an account with that email exists, a password reset link has been sent",
      });
      return;
    }

    const user = result.rows[0];

    // Check if user uses email authentication
    if (user.auth_provider !== "email") {
      res.json({
        message: "If an account with that email exists, a password reset link has been sent",
      });
      return;
    }

    // Generate reset token
    const resetToken = await createPasswordResetToken(user.id);

    // Send reset email
    await sendPasswordResetEmail(user.email, user.name, resetToken);

    res.json({
      message: "If an account with that email exists, a password reset link has been sent",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({
      error: "Password reset request failed",
      message: "An error occurred while processing your request",
    });
  }
});

/**
 * POST /api/auth/password-reset/confirm
 * Confirm password reset with token and new password.
 */
router.post("/password-reset/confirm", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({
        error: "Missing required fields",
        message: "Token and new password are required",
      });
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({
        error: "Weak password",
        message: passwordValidation.error,
      });
      return;
    }

    // Validate and consume reset token
    const userId = await validatePasswordResetToken(token);
    if (!userId) {
      res.status(400).json({
        error: "Invalid or expired token",
        message: "Password reset token is invalid or has expired",
      });
      return;
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user password
    await pool.query(
      `update users set password_hash = $1, updated_at = now() where id = $2`,
      [passwordHash, userId]
    );

    // Invalidate all existing sessions for security
    await invalidateAllSessions(userId);

    res.json({
      message: "Password reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    console.error("Password reset confirm error:", error);
    res.status(500).json({
      error: "Password reset failed",
      message: "An error occurred while resetting your password",
    });
  }
});

// ============================================================================
// Microsoft Azure AD OAuth
// ============================================================================

/**
 * GET /api/auth/microsoft/login
 * Redirect to Microsoft login page.
 */
router.get("/microsoft/login", async (req, res) => {
  try {
    if (!isAzureConfigured()) {
      res.status(503).json({
        error: "Microsoft authentication not configured",
        message: "Azure AD credentials are not set up. Please contact your administrator.",
      });
      return;
    }

    // Generate CSRF protection state
    const state = crypto.randomBytes(16).toString("hex");

    // Store state in session or signed cookie for validation
    // For now, we'll trust the OAuth flow validation
    const authUrl = await getAuthCodeUrl(state);

    res.redirect(authUrl);
  } catch (error) {
    console.error("Microsoft login redirect error:", error);
    res.status(500).json({
      error: "Microsoft login failed",
      message: "Failed to initiate Microsoft authentication",
    });
  }
});

/**
 * GET /api/auth/microsoft/callback
 * Handle OAuth callback from Microsoft.
 */
router.get("/microsoft/callback", async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error("Microsoft OAuth error:", error, error_description);
      res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=${encodeURIComponent(error_description as string || "Authentication failed")}`);
      return;
    }

    if (!code) {
      res.status(400).json({
        error: "Missing authorization code",
        message: "OAuth callback did not include authorization code",
      });
      return;
    }

    // Exchange code for tokens and get user profile
    const profile = await handleCallback(code as string, state as string);

    // Get or create user from Azure profile
    const user = await getOrCreateUser(profile);

    // Check if account is active
    if (user.status !== "active") {
      res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=${encodeURIComponent(`Your account is ${user.status}. Please contact support.`)}`);
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Create session
    await createSession(user.id, refreshToken);

    // Update last login
    await updateLastLogin(user.id);

    // Redirect to frontend with tokens
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/auth/callback?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`);
  } catch (error) {
    console.error("Microsoft callback error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent("Microsoft authentication failed")}`);
  }
});

// ============================================================================
// Export Router
// ============================================================================

export default router;
