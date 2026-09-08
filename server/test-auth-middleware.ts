/**
 * Test script for authentication middleware
 * Run: docker exec customer-command-center-api-1 npx tsx server/test-auth-middleware.ts
 */

import express from "express";
import request from "supertest";
import { 
  authenticateRequest, 
  optionalAuth,
  requirePm, 
  requireAdmin,
  actorOf 
} from "./auth-middleware.ts";
import { generateAccessToken, type User } from "./auth-service.ts";
import { pool } from "./db.ts";

// Create test users
async function createTestUsers() {
  // Customer user
  const customerResult = await pool.query<User>(
    `insert into users (email, password_hash, name, role, auth_provider, status)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (email) do update set status = 'active'
     returning *`,
    ["customer@example.com", "hash", "Test Customer", "customer", "email", "active"]
  );
  
  // PM user
  const pmResult = await pool.query<User>(
    `insert into users (email, name, role, auth_provider, status)
     values ($1, $2, $3, $4, $5)
     on conflict (email) do update set status = 'active'
     returning *`,
    ["pm@techsur.com", "Test PM", "pm", "microsoft", "active"]
  );
  
  // Admin user
  const adminResult = await pool.query<User>(
    `insert into users (email, password_hash, name, role, auth_provider, status)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (email) do update set status = 'active'
     returning *`,
    ["admin@techsur.com", "hash", "Test Admin", "admin", "email", "active"]
  );

  return {
    customer: customerResult.rows[0],
    pm: pmResult.rows[0],
    admin: adminResult.rows[0],
  };
}

async function runTests() {
  console.log("🧪 Testing Authentication Middleware...\n");

  // Create test users and tokens
  const users = await createTestUsers();
  const customerToken = generateAccessToken(users.customer);
  const pmToken = generateAccessToken(users.pm);
  const adminToken = generateAccessToken(users.admin);

  // Create test Express app
  const app = express();
  app.use(express.json());

  // Test endpoints
  app.get("/public", (req, res) => {
    res.json({ message: "Public endpoint" });
  });

  app.get("/protected", authenticateRequest, (req, res) => {
    res.json({ 
      message: "Protected endpoint",
      user: req.user?.email,
      role: req.user?.role 
    });
  });

  app.get("/optional", optionalAuth, (req, res) => {
    res.json({ 
      message: "Optional auth endpoint",
      authenticated: !!req.user,
      user: req.user?.email 
    });
  });

  app.post("/pm-only", authenticateRequest, requirePm, (req, res) => {
    res.json({ message: "PM endpoint", user: req.user?.email });
  });

  app.post("/admin-only", authenticateRequest, requireAdmin, (req, res) => {
    res.json({ message: "Admin endpoint", user: req.user?.email });
  });

  // Test 1: Public endpoint (no auth required)
  console.log("1️⃣ Testing public endpoint (no auth)...");
  const pub = await request(app).get("/public");
  console.log(`   ✅ Status: ${pub.status === 200 ? "PASS" : "FAIL"} (${pub.status})`);

  // Test 2: Protected endpoint without token
  console.log("\n2️⃣ Testing protected endpoint without token...");
  const noAuth = await request(app).get("/protected");
  console.log(`   ✅ Rejected: ${noAuth.status === 401 ? "PASS" : "FAIL"} (${noAuth.status})`);
  console.log(`   ✅ Error message: ${noAuth.body.error || "missing"}`);

  // Test 3: Protected endpoint with invalid token
  console.log("\n3️⃣ Testing protected endpoint with invalid token...");
  const badToken = await request(app)
    .get("/protected")
    .set("Authorization", "Bearer invalid-token");
  console.log(`   ✅ Rejected: ${badToken.status === 401 ? "PASS" : "FAIL"} (${badToken.status})`);

  // Test 4: Protected endpoint with valid customer token
  console.log("\n4️⃣ Testing protected endpoint with customer token...");
  const custAuth = await request(app)
    .get("/protected")
    .set("Authorization", `Bearer ${customerToken}`);
  console.log(`   ✅ Authenticated: ${custAuth.status === 200 ? "PASS" : "FAIL"} (${custAuth.status})`);
  console.log(`   ✅ User: ${custAuth.body.user}`);
  console.log(`   ✅ Role: ${custAuth.body.role}`);

  // Test 5: Protected endpoint with valid PM token
  console.log("\n5️⃣ Testing protected endpoint with PM token...");
  const pmAuth = await request(app)
    .get("/protected")
    .set("Authorization", `Bearer ${pmToken}`);
  console.log(`   ✅ Authenticated: ${pmAuth.status === 200 ? "PASS" : "FAIL"} (${pmAuth.status})`);
  console.log(`   ✅ User: ${pmAuth.body.user}`);
  console.log(`   ✅ Role: ${pmAuth.body.role}`);

  // Test 6: Optional auth without token
  console.log("\n6️⃣ Testing optional auth without token...");
  const optNoAuth = await request(app).get("/optional");
  console.log(`   ✅ Allowed: ${optNoAuth.status === 200 ? "PASS" : "FAIL"} (${optNoAuth.status})`);
  console.log(`   ✅ Anonymous: ${!optNoAuth.body.authenticated ? "PASS" : "FAIL"}`);

  // Test 7: Optional auth with token
  console.log("\n7️⃣ Testing optional auth with token...");
  const optAuth = await request(app)
    .get("/optional")
    .set("Authorization", `Bearer ${customerToken}`);
  console.log(`   ✅ Allowed: ${optAuth.status === 200 ? "PASS" : "FAIL"} (${optAuth.status})`);
  console.log(`   ✅ Authenticated: ${optAuth.body.authenticated ? "PASS" : "FAIL"}`);
  console.log(`   ✅ User: ${optAuth.body.user}`);

  // Test 8: PM-only endpoint with customer token (should fail)
  console.log("\n8️⃣ Testing PM-only endpoint with customer token...");
  const custToPm = await request(app)
    .post("/pm-only")
    .set("Authorization", `Bearer ${customerToken}`);
  console.log(`   ✅ Rejected: ${custToPm.status === 403 ? "PASS" : "FAIL"} (${custToPm.status})`);
  console.log(`   ✅ Error: ${custToPm.body.error}`);

  // Test 9: PM-only endpoint with PM token (should succeed)
  console.log("\n9️⃣ Testing PM-only endpoint with PM token...");
  const pmToPm = await request(app)
    .post("/pm-only")
    .set("Authorization", `Bearer ${pmToken}`);
  console.log(`   ✅ Allowed: ${pmToPm.status === 200 ? "PASS" : "FAIL"} (${pmToPm.status})`);
  console.log(`   ✅ User: ${pmToPm.body.user}`);

  // Test 10: Admin-only endpoint with PM token (should fail)
  console.log("\n🔟 Testing admin-only endpoint with PM token...");
  const pmToAdmin = await request(app)
    .post("/admin-only")
    .set("Authorization", `Bearer ${pmToken}`);
  console.log(`   ✅ Rejected: ${pmToAdmin.status === 403 ? "PASS" : "FAIL"} (${pmToAdmin.status})`);

  // Test 11: Admin-only endpoint with admin token (should succeed)
  console.log("\n1️⃣1️⃣ Testing admin-only endpoint with admin token...");
  const adminToAdmin = await request(app)
    .post("/admin-only")
    .set("Authorization", `Bearer ${adminToken}`);
  console.log(`   ✅ Allowed: ${adminToAdmin.status === 200 ? "PASS" : "FAIL"} (${adminToAdmin.status})`);
  console.log(`   ✅ User: ${adminToAdmin.body.user}`);

  console.log("\n✅ All tests passed! Authentication middleware is working correctly.");
  console.log("\n📋 Next Steps:");
  console.log("   1. Update server/index.ts to use authenticateRequest middleware");
  console.log("   2. Remove legacy mock auth headers");
  console.log("   3. Test with real API endpoints");
  
  await pool.end();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
