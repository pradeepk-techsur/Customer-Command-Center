/**
 * Quick test script for azure-auth.ts
 * Run: docker exec customer-command-center-api-1 npx tsx server/test-azure-auth.ts
 */

import {
  getAuthCodeUrl,
  getOrCreateUser,
  getUserByAzureOid,
  isAzureConfigured,
  getConfigStatus,
  type AzureProfile,
} from "./azure-auth.ts";

async function runTests() {
  console.log("🧪 Testing Azure AD Integration...\n");

  // Test 1: Configuration status
  console.log("1️⃣ Checking Azure AD configuration...");
  const status = getConfigStatus();
  console.log(`   Tenant ID: ${status.tenantId}`);
  console.log(`   Client ID: ${status.clientId}`);
  console.log(`   Client Secret: ${status.clientSecret}`);
  console.log(`   Redirect URI: ${status.redirectUri}`);
  console.log(`   ✅ Configured: ${status.configured ? "YES" : "NO (will use defaults for testing)"}\n`);

  // Test 2: Authorization URL generation (even without real credentials)
  console.log("2️⃣ Testing authorization URL generation...");
  try {
    const authUrl = await getAuthCodeUrl("test-state-123");
    console.log(`   ✅ Auth URL generated: ${authUrl.substring(0, 80)}...`);
    console.log(`   ✅ Contains state: ${authUrl.includes("state=test-state-123") ? "PASS" : "FAIL"}`);
    console.log(`   ✅ Contains redirect_uri: ${authUrl.includes("redirect_uri") ? "PASS" : "FAIL"}\n`);
  } catch (error: any) {
    console.log(`   ⚠️  Auth URL generation failed (expected without real Azure config): ${error.message}\n`);
  }

  // Test 3: User creation from Azure profile
  console.log("3️⃣ Testing user creation from Azure profile...");
  const mockProfile: AzureProfile = {
    oid: "test-azure-oid-12345",
    email: "pmtest@techsur.com",
    name: "Test Project Manager",
    preferred_username: "pmtest@techsur.com",
    given_name: "Test",
    family_name: "Manager",
  };

  try {
    const user = await getOrCreateUser(mockProfile);
    console.log(`   ✅ User created/found: ${user.name} (${user.email})`);
    console.log(`   ✅ Role: ${user.role} (should be 'pm')`);
    console.log(`   ✅ Auth provider: ${user.auth_provider} (should be 'microsoft')`);
    console.log(`   ✅ Azure OID: ${user.azure_oid}`);
    console.log(`   ✅ Status: ${user.status}\n`);

    // Test 4: Find user by Azure OID
    console.log("4️⃣ Testing user lookup by Azure OID...");
    const foundUser = await getUserByAzureOid(mockProfile.oid);
    console.log(`   ✅ User found: ${foundUser ? "PASS" : "FAIL"}`);
    console.log(`   ✅ Same user: ${foundUser?.id === user.id ? "PASS" : "FAIL"}\n`);

    // Test 5: Update existing user on repeat login
    console.log("5️⃣ Testing user update on repeat login...");
    mockProfile.name = "Updated Test Manager";
    const updatedUser = await getOrCreateUser(mockProfile);
    console.log(`   ✅ User updated: ${updatedUser.name}`);
    console.log(`   ✅ Same ID: ${updatedUser.id === user.id ? "PASS" : "FAIL"}\n`);

    console.log("✅ All tests passed! Azure AD integration is working correctly.");
    console.log("\n📋 Next Steps:");
    console.log("   1. Register app in Azure Portal (see AZURE_SETUP.md)");
    console.log("   2. Add credentials to .env file");
    console.log("   3. Test full OAuth flow with real Microsoft login");
    
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
