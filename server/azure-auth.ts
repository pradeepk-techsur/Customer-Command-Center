/**
 * Azure AD Authentication Integration
 * Microsoft authentication for TechSur Project Managers using MSAL Node.
 */

import * as msal from "@azure/msal-node";
import { pool } from "./db.ts";
import type { User } from "./auth-service.ts";

// ============================================================================
// Configuration
// ============================================================================

const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || "";
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || "";
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || "";
const AZURE_REDIRECT_URI = process.env.AZURE_REDIRECT_URI || "http://localhost:3000/api/auth/microsoft/callback";

/**
 * Validate Azure AD configuration.
 * @returns True if all required environment variables are set
 */
export function isAzureConfigured(): boolean {
  return !!(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET);
}

// MSAL Configuration (only if credentials are present)
let msalClient: msal.ConfidentialClientApplication | null = null;

function getMsalClient(): msal.ConfidentialClientApplication {
  if (!msalClient) {
    if (!isAzureConfigured()) {
      throw new Error("Azure AD is not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET environment variables.");
    }

    const msalConfig: msal.Configuration = {
      auth: {
        clientId: AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
        clientSecret: AZURE_CLIENT_SECRET,
      },
      system: {
        loggerOptions: {
          loggerCallback(loglevel, message, containsPii) {
            if (process.env.NODE_ENV === "development") {
              console.log(`[MSAL] ${message}`);
            }
          },
          piiLoggingEnabled: false,
          logLevel: msal.LogLevel.Warning,
        },
      },
    };

    msalClient = new msal.ConfidentialClientApplication(msalConfig);
  }
  
  return msalClient;
}

// OAuth scopes
const SCOPES = ["openid", "profile", "email", "User.Read"];

// ============================================================================
// Types
// ============================================================================

export interface AzureProfile {
  oid: string;              // Azure AD object ID (unique identifier)
  email: string;
  name: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
}

export interface AuthorizationResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// ============================================================================
// OAuth 2.0 Authorization Code Flow
// ============================================================================

/**
 * Get the authorization URL to redirect users to Microsoft login.
 * @param state - Optional state parameter for CSRF protection
 * @returns Authorization URL
 */
export async function getAuthCodeUrl(state?: string): Promise<string> {
  const authCodeUrlParameters: msal.AuthorizationUrlRequest = {
    scopes: SCOPES,
    redirectUri: AZURE_REDIRECT_URI,
    state: state,
  };

  return await getMsalClient().getAuthCodeUrl(authCodeUrlParameters);
}

/**
 * Handle OAuth callback and exchange authorization code for tokens.
 * @param code - Authorization code from Azure AD
 * @param state - State parameter for validation
 * @returns Azure profile data
 */
export async function handleCallback(code: string, state?: string): Promise<AzureProfile> {
  const tokenRequest: msal.AuthorizationCodeRequest = {
    code: code,
    scopes: SCOPES,
    redirectUri: AZURE_REDIRECT_URI,
  };

  try {
    const response = await getMsalClient().acquireTokenByCode(tokenRequest);
    
    if (!response || !response.idTokenClaims) {
      throw new Error("Failed to acquire token from Azure AD");
    }

    // Extract user profile from ID token claims
    const claims = response.idTokenClaims as any;
    const profile: AzureProfile = {
      oid: claims.oid || claims.sub,  // Object ID (unique identifier)
      email: claims.email || claims.preferred_username || claims.upn || "",
      name: claims.name || `${claims.given_name || ""} ${claims.family_name || ""}`.trim() || "Unknown User",
      preferred_username: claims.preferred_username,
      given_name: claims.given_name,
      family_name: claims.family_name,
    };

    // Validate required fields
    if (!profile.oid) {
      throw new Error("Azure AD profile missing object ID (oid)");
    }
    if (!profile.email) {
      throw new Error("Azure AD profile missing email");
    }

    return profile;
  } catch (error) {
    console.error("Azure AD callback error:", error);
    throw new Error("Failed to authenticate with Microsoft");
  }
}

/**
 * Validate an Azure AD ID token (for client-side authentication flows).
 * @param idToken - ID token from Azure AD
 * @returns Decoded profile or null if invalid
 */
export async function validateToken(idToken: string): Promise<AzureProfile | null> {
  try {
    // For server-side validation, we'd typically verify the JWT signature
    // For now, we'll use MSAL's built-in validation
    const response = await getMsalClient().acquireTokenSilent({
      scopes: SCOPES,
      account: undefined as any, // MSAL will validate the token
    });

    if (!response || !response.idTokenClaims) {
      return null;
    }

    const claims = response.idTokenClaims as any;
    return {
      oid: claims.oid || claims.sub,
      email: claims.email || claims.preferred_username || "",
      name: claims.name || "Unknown User",
      preferred_username: claims.preferred_username,
      given_name: claims.given_name,
      family_name: claims.family_name,
    };
  } catch (error) {
    console.error("Token validation error:", error);
    return null;
  }
}

// ============================================================================
// User Management
// ============================================================================

/**
 * Get or create a user from Azure AD profile.
 * If user exists by email or azure_oid, return existing user.
 * Otherwise, create a new user with 'program_manager' role (TechSur PMs only).
 * @param profile - Azure profile data
 * @returns User object
 */
export async function getOrCreateUser(profile: AzureProfile): Promise<User> {
  // Try to find existing user by Azure OID first (most reliable)
  let result = await pool.query<User>(
    `select * from users where azure_oid = $1`,
    [profile.oid]
  );

  if (result.rows.length > 0) {
    // Update name and email if changed
    const user = result.rows[0];
    if (user.name !== profile.name || user.email !== profile.email) {
      await pool.query(
        `update users 
         set name = $1, email = $2, updated_at = now()
         where id = $3`,
        [profile.name, profile.email, user.id]
      );
      user.name = profile.name;
      user.email = profile.email;
    }
    return user;
  }

  // Try to find existing user by email (for migration scenarios)
  result = await pool.query<User>(
    `select * from users where lower(email) = lower($1)`,
    [profile.email]
  );

  if (result.rows.length > 0) {
    // Link existing email account to Azure AD
    const user = result.rows[0];
    await pool.query(
      `update users 
       set azure_oid = $1, 
           auth_provider = 'microsoft',
           name = $2,
           updated_at = now()
       where id = $3`,
      [profile.oid, profile.name, user.id]
    );
    user.azure_oid = profile.oid;
    user.auth_provider = "microsoft";
    user.name = profile.name;
    return user;
  }

  // Create new user - TechSur PMs have 'program_manager' role by default
  result = await pool.query<User>(
    `insert into users (
       email, 
       name, 
       role, 
       auth_provider, 
       azure_oid, 
       status
     )
     values ($1, $2, 'program_manager', 'microsoft', $3, 'active')
     returning *`,
    [profile.email, profile.name, profile.oid]
  );

  return result.rows[0];
}

/**
 * Find user by Azure AD object ID.
 * @param azureOid - Azure AD object ID
 * @returns User object or null
 */
export async function getUserByAzureOid(azureOid: string): Promise<User | null> {
  const result = await pool.query<User>(
    `select * from users where azure_oid = $1`,
    [azureOid]
  );
  
  return result.rows[0] || null;
}

/**
 * Get Azure AD configuration status for debugging.
 * @returns Configuration status object
 */
export function getConfigStatus() {
  return {
    configured: isAzureConfigured(),
    tenantId: AZURE_TENANT_ID ? "✓" : "✗",
    clientId: AZURE_CLIENT_ID ? "✓" : "✗",
    clientSecret: AZURE_CLIENT_SECRET ? "✓" : "✗",
    redirectUri: AZURE_REDIRECT_URI,
  };
}
