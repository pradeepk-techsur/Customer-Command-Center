import assert from "node:assert/strict";
import test from "node:test";
import { callOrderLabel } from "../src/lib/format.ts";

test("formats grouped and period-specific call-order labels", () => {
  assert.equal(callOrderLabel("Enterprise Architecture Support", "Call 020"), "Enterprise Architecture Support (Call 020)");
  assert.equal(callOrderLabel("Enterprise Architecture Support", "Call 20.2"), "Enterprise Architecture Support (Call 20.2)");
  assert.equal(callOrderLabel("Enterprise Architecture Support"), "Enterprise Architecture Support");
});
