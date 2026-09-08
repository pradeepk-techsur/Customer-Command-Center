/**
 * Authentication & Authorization
 * 
 * This file re-exports from auth-middleware.ts for backward compatibility.
 * The new JWT-based authentication system is in auth-middleware.ts.
 * 
 * MIGRATION STATUS: This file maintains backward compatibility with existing code.
 * New code should import directly from auth-middleware.ts.
 */

// Re-export everything from auth-middleware for backward compatibility
export {
  authenticateRequest,
  optionalAuth,
  requirePm,
  requireAdmin,
  requirePmOrAdmin,
  actorOf,
  type Actor,
} from "./auth-middleware.ts";
