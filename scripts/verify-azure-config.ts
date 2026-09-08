#!/usr/bin/env tsx
/**
 * Verify Azure AD configuration for SSO
 * 
 * Run: npx tsx scripts/verify-azure-config.ts
 */

import { getConfigStatus } from "../server/azure-auth.ts";

console.log("\n🔍 Azure AD Configuration Check\n");
console.log("=" .repeat(50));

const status = getConfigStatus();
const envVars = {
  AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
  AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
  AZURE_REDIRECT_URI: process.env.AZURE_REDIRECT_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL,
};

console.log("\n📋 Environment Variables Status:\n");

const checkVar = (name: string, value: string | undefined, required: boolean = true) => {
  const hasValue = value && value.length > 0 && !value.includes("your-") && !value.includes("-here");
  const status = hasValue ? "✅" : (required ? "❌" : "⚠️");
  const displayValue = hasValue 
    ? (name.includes("SECRET") ? "***" + value.slice(-4) : value.slice(0, 20) + (value.length > 20 ? "..." : ""))
    : "NOT SET";
  
  console.log(`  ${status} ${name.padEnd(25)} ${displayValue}`);
  return hasValue;
};

const tenantOk = checkVar("AZURE_TENANT_ID", envVars.AZURE_TENANT_ID);
const clientOk = checkVar("AZURE_CLIENT_ID", envVars.AZURE_CLIENT_ID);
const secretOk = checkVar("AZURE_CLIENT_SECRET", envVars.AZURE_CLIENT_SECRET);
const redirectOk = checkVar("AZURE_REDIRECT_URI", envVars.AZURE_REDIRECT_URI);
const jwtOk = checkVar("JWT_SECRET", envVars.JWT_SECRET);
const sessionOk = checkVar("SESSION_SECRET", envVars.SESSION_SECRET);
const frontendOk = checkVar("FRONTEND_URL", envVars.FRONTEND_URL, false);

console.log("\n📊 Overall Status:\n");
console.log(`  Azure AD Status: ${status}`);

const azureReady = tenantOk && clientOk && secretOk;
const tokensReady = jwtOk && sessionOk;

if (azureReady && tokensReady) {
  console.log("\n✅ Configuration Complete!");
  console.log("\n🚀 Next Steps:");
  console.log("  1. Restart API: docker compose restart api");
  console.log("  2. Open http://localhost:5173/login");
  console.log("  3. Click 'Sign in with Microsoft'");
  console.log("  4. Login with your Microsoft account");
} else {
  console.log("\n❌ Configuration Incomplete\n");
  
  if (!azureReady) {
    console.log("📝 Azure AD Setup Required:");
    console.log("  1. Go to portal.azure.com");
    console.log("  2. Microsoft Entra ID → App registrations → New registration");
    console.log("  3. Name: 'Contract Transparency Portal - Dev'");
    console.log("  4. Redirect URI: http://localhost:3000/api/auth/microsoft/callback");
    console.log("  5. Add permissions: openid, profile, email, User.Read");
    console.log("  6. Create client secret");
    console.log("  7. Copy Tenant ID, Client ID, Client Secret to .env\n");
  }
  
  if (!tokensReady) {
    console.log("🔑 Generate JWT Secrets:");
    console.log("  Run: openssl rand -base64 32");
    console.log("  Add both JWT_SECRET and SESSION_SECRET to .env\n");
  }
  
  console.log("💡 Edit .env file and re-run this script to verify.");
}

console.log("\n" + "=".repeat(50) + "\n");
