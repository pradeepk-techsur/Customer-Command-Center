import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCallNumber, validateCallOrderSetup } from "./call-order-setup.ts";

test("normalizes an entered call number to period and group identifiers", () => {
  assert.deepEqual(normalizeCallNumber("020"), { id: "Call 20", groupKey: "Call 020" });
  assert.deepEqual(normalizeCallNumber("Call 7"), { id: "Call 7", groupKey: "Call 007" });
  assert.deepEqual(normalizeCallNumber("007.02"), { id: "Call 7.2", groupKey: "Call 007" });
  assert.equal(normalizeCallNumber("7.0"), null);
});

test("validates and normalizes a complete setup", () => {
  const result = validateCallOrderSetup({
    callNumber: "20",
    name: " Enterprise Architecture Support ",
    description: "Scope",
    narrative: "",
    popStart: "2026-09-25",
    popEnd: "2027-09-24",
    funded: "$5,447,029.88",
    spend: "0",
    eac: "",
    overUnder: "-10.50",
    pm: "",
  }, true);

  assert.deepEqual(result.errors, {});
  assert.equal(result.value?.funded, 5447029.88);
  assert.equal(result.value?.overUnder, -10.5);
  assert.equal(result.value?.pm, "Unassigned");
});

test("rejects invalid dates and negative funding", () => {
  const result = validateCallOrderSetup({
    callNumber: "0",
    name: "",
    popStart: "2027-02-30",
    popEnd: "2026-01-01",
    funded: "-1",
    spend: "0",
  }, true);
  assert.ok(result.errors.callNumber);
  assert.ok(result.errors.name);
  assert.ok(result.errors.popStart);
  assert.ok(result.errors.funded);
});
