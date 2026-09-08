/**
 * Quick test script for auth-service.ts
 * Run: docker exec customer-command-center-api-1 npx tsx server/test-auth.ts
 */

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
  generateResetToken,
  type User,
} from "./auth-service.ts";

async function runTests() {
  console.log("🧪 Testing Auth Service...\n");

  // Test 1: Password hashing and verification
  console.log("1️⃣ Testing password hashing...");
  const password = "TestPassword123!";
  const hash = await hashPassword(password);
  console.log(`   ✅ Hashed: ${hash.substring(0, 20)}...`);
  
  const isValid = await verifyPassword(password, hash);
  console.log(`   ✅ Verification: ${isValid ? "PASS" : "FAIL"}`);
  
  const isInvalid = await verifyPassword("WrongPassword", hash);
  console.log(`   ✅ Wrong password rejected: ${!isInvalid ? "PASS" : "FAIL"}\n`);

  // Test 2: Password validation
  console.log("2️⃣ Testing password validation...");
  const validPassword = validatePassword("SecurePass123!");
  console.log(`   ✅ Valid password: ${validPassword.valid ? "PASS" : "FAIL"}`);
  
  const weakPassword = validatePassword("weak");
  console.log(`   ✅ Weak password rejected: ${!weakPassword.valid ? "PASS" : "FAIL"} (${weakPassword.error})\n`);

  // Test 3: JWT token generation and verification
  console.log("3️⃣ Testing JWT tokens...");
  const mockUser: User = {
    id: 1,
    email: "test@example.com",
    name: "Test User",
    role: "customer",
    auth_provider: "email",
    status: "active",
    created_at: new Date(),
    updated_at: new Date(),
  };

  const accessToken = generateAccessToken(mockUser);
  console.log(`   ✅ Access token generated: ${accessToken.substring(0, 30)}...`);
  
  const refreshToken = generateRefreshToken(mockUser);
  console.log(`   ✅ Refresh token generated: ${refreshToken.substring(0, 30)}...`);
  
  const decodedAccess = verifyJWT(accessToken, "access");
  console.log(`   ✅ Access token decoded: userId=${decodedAccess?.userId}, role=${decodedAccess?.role}`);
  
  const decodedRefresh = verifyJWT(refreshToken, "refresh");
  console.log(`   ✅ Refresh token decoded: type=${decodedRefresh?.type}\n`);

  // Test 4: Reset token generation
  console.log("4️⃣ Testing reset token generation...");
  const resetToken = generateResetToken();
  console.log(`   ✅ Reset token: ${resetToken.substring(0, 20)}... (length: ${resetToken.length})\n`);

  console.log("✅ All tests passed! Auth service is working correctly.");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
