import assert from "node:assert/strict";
import test from "node:test";
import { callOrderLabel, normalizeCallOrderId } from "../src/lib/format.ts";

test("formats grouped and period-specific call-order labels", () => {
  assert.equal(callOrderLabel("Enterprise Architecture Support", "Call 020"), "Enterprise Architecture Support (Call 020)");
  assert.equal(callOrderLabel("Enterprise Architecture Support", "Call 20.2"), "Enterprise Architecture Support (Call 20.2)");
  assert.equal(callOrderLabel("Enterprise Architecture Support"), "Enterprise Architecture Support");
});

test("normalizes user-entered base and funded-period IDs", () => {
  assert.equal(normalizeCallOrderId("020"), "Call 20");
  assert.equal(normalizeCallOrderId("Call 013.02"), "Call 13.2");
  assert.equal(normalizeCallOrderId("Call 13.0"), null);
});
