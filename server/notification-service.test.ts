import assert from "node:assert/strict";
import test from "node:test";
import type { Queryable } from "./db.ts";
import { hashPasswordResetToken } from "./auth-service.ts";
import { enqueueDocumentNotifications } from "./notification-service.ts";

test("document notifications select only scoped customers and persist complete jobs", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const db = {
    async query(text: string, values: unknown[] = []) {
      calls.push({ text, values });
      if (text.includes("select u.id")) {
        return { rows: [{ id: 12, email: "customer@example.gov" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
  } as unknown as Queryable;

  const queued = await enqueueDocumentNotifications(db, {
    eventKey: "deliverable:44:file-created",
    documentType: "Monthly Status Report",
    documentName: "October MSR.pdf",
    callOrderId: "Call 002",
    scopeLabel: "Call 002",
    periodLabel: "October 2026",
    uploaderUserId: 7,
    uploadedBy: "Program Manager",
    dashboardPath: "/?page=deliverables",
  });

  assert.equal(queued, 1);
  assert.match(calls[0].text, /u\.role = 'customer'/);
  assert.match(calls[0].text, /u\.status = 'active'/);
  assert.match(calls[0].text, /user_call_orders/);
  assert.deepEqual(calls[0].values, [7, "Call 002"]);
  assert.deepEqual(calls[1].values, [
    "deliverable:44:file-created", 12, "customer@example.gov", "Call 002", false,
    "Monthly Status Report", "October MSR.pdf", "Call 002", "October 2026",
    "Program Manager", "/?page=deliverables",
  ]);
});

test("program report notifications require an assigned call order", async () => {
  let recipientSql = "";
  const db = {
    async query(text: string) {
      recipientSql = text;
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Queryable;

  const queued = await enqueueDocumentNotifications(db, {
    eventKey: "monthly-report:9:customer-release",
    documentType: "Monthly status report",
    documentName: "October MSR.pdf",
    callOrderId: null,
    requireAssignedCallOrder: true,
  });

  assert.equal(queued, 0);
  assert.match(recipientSql, /exists \(select 1 from user_call_orders/);
});

test("password reset tokens are stored as deterministic hashes", () => {
  const token = "plain-reset-token";
  const hash = hashPasswordResetToken(token);
  assert.notEqual(hash, token);
  assert.equal(hash, hashPasswordResetToken(token));
  assert.match(hash, /^[a-f0-9]{64}$/);
});
