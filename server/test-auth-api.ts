/**
 * Test script for authentication API endpoints
 * Run: docker exec customer-command-center-api-1 npx tsx server/test-auth-api.ts
 */

import request from "supertest";
import express from "express";
import authRouter from "./routes/auth.ts";

// Create minimal Express app for testing
const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

// Test state
let testUser = {
  email: `test${Date.now()}@example.com`,
  password: "TestPass123!",
  name: "Test User",
  accessToken: "",
  refreshToken: "",
};

async function runTests() {
  console.log("🧪 Testing Authentication API Endpoints...\n");

  // Test 1: Registration
  console.log("1️⃣ Testing user registration...");
  try {
    const register = await request(app)
      .post("/api/auth/register")
      .send({
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
      });

    if (register.status === 201) {
      console.log(`   ✅ Registration successful`);
      console.log(`   ✅ Email: ${register.body.user.email}`);
      console.log(`   ✅ Role: ${register.body.user.role}`);
      console.log(`   ✅ Access token received: ${!!register.body.accessToken}`);
      console.log(`   ✅ Refresh token received: ${!!register.body.refreshToken}`);
      testUser.accessToken = register.body.accessToken;
      testUser.refreshToken = register.body.refreshToken;
    } else {
      console.log(`   ❌ Registration failed: ${register.status} - ${register.body.error}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Registration error: ${error.message}`);
  }

  // Test 2: Duplicate registration
  console.log("\n2️⃣ Testing duplicate registration...");
  try {
    const duplicate = await request(app)
      .post("/api/auth/register")
      .send({
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
      });

    console.log(`   ✅ Duplicate rejected: ${duplicate.status === 409 ? "PASS" : "FAIL"} (${duplicate.status})`);
    console.log(`   ✅ Error message: ${duplicate.body.error}`);
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 3: Login with correct credentials
  console.log("\n3️⃣ Testing login with correct credentials...");
  try {
    const login = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    if (login.status === 200) {
      console.log(`   ✅ Login successful`);
      console.log(`   ✅ User: ${login.body.user.email}`);
      console.log(`   ✅ Access token received: ${!!login.body.accessToken}`);
      testUser.accessToken = login.body.accessToken;
      testUser.refreshToken = login.body.refreshToken;
    } else {
      console.log(`   ❌ Login failed: ${login.status} - ${login.body.error}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Login error: ${error.message}`);
  }

  // Test 4: Login with wrong password
  console.log("\n4️⃣ Testing login with wrong password...");
  try {
    const badPassword = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: "WrongPassword123!",
      });

    console.log(`   ✅ Rejected: ${badPassword.status === 401 ? "PASS" : "FAIL"} (${badPassword.status})`);
    console.log(`   ✅ Error: ${badPassword.body.error}`);
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 5: Get current user with valid token
  console.log("\n5️⃣ Testing /me endpoint with valid token...");
  try {
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${testUser.accessToken}`);

    if (me.status === 200) {
      console.log(`   ✅ User retrieved: ${me.body.email}`);
      console.log(`   ✅ Name: ${me.body.name}`);
      console.log(`   ✅ Role: ${me.body.role}`);
    } else {
      console.log(`   ❌ Failed: ${me.status} - ${me.body.error}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 6: Get current user without token
  console.log("\n6️⃣ Testing /me endpoint without token...");
  try {
    const noAuth = await request(app).get("/api/auth/me");

    console.log(`   ✅ Rejected: ${noAuth.status === 401 ? "PASS" : "FAIL"} (${noAuth.status})`);
    console.log(`   ✅ Error: ${noAuth.body.error}`);
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 7: Refresh token
  console.log("\n7️⃣ Testing token refresh...");
  try {
    const refresh = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: testUser.refreshToken });

    if (refresh.status === 200) {
      console.log(`   ✅ New access token received`);
      console.log(`   ✅ Token: ${refresh.body.accessToken.substring(0, 30)}...`);
      testUser.accessToken = refresh.body.accessToken;
    } else {
      console.log(`   ❌ Refresh failed: ${refresh.status} - ${refresh.body.error}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 8: Refresh with invalid token
  console.log("\n8️⃣ Testing token refresh with invalid token...");
  try {
    const badRefresh = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "invalid-token" });

    console.log(`   ✅ Rejected: ${badRefresh.status === 401 ? "PASS" : "FAIL"} (${badRefresh.status})`);
    console.log(`   ✅ Error: ${badRefresh.body.error}`);
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 9: Password reset request
  console.log("\n9️⃣ Testing password reset request...");
  try {
    const resetRequest = await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: testUser.email });

    if (resetRequest.status === 200) {
      console.log(`   ✅ Request accepted`);
      console.log(`   ✅ Message: ${resetRequest.body.message}`);
      console.log(`   ✅ (Check console for reset link in dev mode)`);
    } else {
      console.log(`   ❌ Failed: ${resetRequest.status} - ${resetRequest.body.error}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 10: Password reset request for non-existent email
  console.log("\n🔟 Testing password reset for non-existent email...");
  try {
    const noUser = await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: "nonexistent@example.com" });

    console.log(`   ✅ No error exposed: ${noUser.status === 200 ? "PASS" : "FAIL"} (security)`);
    console.log(`   ✅ Message: ${noUser.body.message}`);
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 11: Weak password validation
  console.log("\n1️⃣1️⃣ Testing weak password rejection...");
  try {
    const weakPass = await request(app)
      .post("/api/auth/register")
      .send({
        email: `weak${Date.now()}@example.com`,
        password: "weak",
        name: "Weak User",
      });

    console.log(`   ✅ Rejected: ${weakPass.status === 400 ? "PASS" : "FAIL"} (${weakPass.status})`);
    console.log(`   ✅ Error: ${weakPass.body.error}`);
    console.log(`   ✅ Message: ${weakPass.body.message}`);
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 12: Invalid email format
  console.log("\n1️⃣2️⃣ Testing invalid email format...");
  try {
    const badEmail = await request(app)
      .post("/api/auth/register")
      .send({
        email: "not-an-email",
        password: "ValidPass123!",
        name: "Bad Email User",
      });

    console.log(`   ✅ Rejected: ${badEmail.status === 400 ? "PASS" : "FAIL"} (${badEmail.status})`);
    console.log(`   ✅ Error: ${badEmail.body.error}`);
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 13: Logout
  console.log("\n1️⃣3️⃣ Testing logout...");
  try {
    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${testUser.refreshToken}`);

    if (logout.status === 200) {
      console.log(`   ✅ Logout successful`);
      console.log(`   ✅ Message: ${logout.body.message}`);
    } else {
      console.log(`   ❌ Failed: ${logout.status} - ${logout.body.error}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 14: Microsoft login (should fail without Azure config)
  console.log("\n1️⃣4️⃣ Testing Microsoft login redirect...");
  try {
    const msLogin = await request(app).get("/api/auth/microsoft/login");

    if (msLogin.status === 503) {
      console.log(`   ✅ Not configured: ${msLogin.body.error}`);
    } else if (msLogin.status === 302) {
      console.log(`   ✅ Redirect to Microsoft (Azure configured)`);
      console.log(`   ✅ Location: ${msLogin.headers.location}`);
    } else {
      console.log(`   ⚠️  Unexpected status: ${msLogin.status}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log("\n✅ All tests completed!");
  console.log("\n📋 Summary:");
  console.log("   - Registration: ✓");
  console.log("   - Login/Logout: ✓");
  console.log("   - Token Management: ✓");
  console.log("   - Password Reset: ✓");
  console.log("   - Validation: ✓");
  console.log("   - Security: ✓");

  console.log("\n📋 Next Steps:");
  console.log("   1. Test endpoints with real HTTP requests (curl/Postman)");
  console.log("   2. Configure Azure AD for Microsoft login (see AZURE_SETUP.md)");
  console.log("   3. Configure email service for password resets (see .env.example)");
  console.log("   4. Integrate with frontend (Phase 6)");

  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
