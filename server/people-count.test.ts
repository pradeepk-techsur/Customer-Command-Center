import assert from "node:assert/strict";
import test from "node:test";
import type { CallOrder, StaffMember } from "../shared/types.ts";
import { effectivePeriod, groupCallOrders } from "../src/lib/callOrderGroups.ts";
import { filled, isAssigned, isVacant } from "../src/lib/format.ts";

function staff(name: string, status: string): StaffMember {
  return { name, status } as StaffMember;
}

function period(id: string, popStart: string, popEnd: string, roster: StaffMember[] = []): CallOrder {
  return {
    id,
    groupKey: "Call 1",
    groupName: "Test call order",
    name: "Test call order",
    popStart,
    popEnd,
    staff: roster,
  } as CallOrder;
}

test("vacancies are recognized by status and by legacy VACANT names", () => {
  assert.equal(isVacant(staff("Jane Doe", "Vacant")), true);
  assert.equal(isVacant(staff("  VACANT - Engineer", "Recruiting")), true);
  assert.equal(isAssigned(staff("Jane Doe", "Vacant")), false);
  assert.equal(isAssigned(staff("Jane Doe", "Offboarded")), false);
  assert.equal(isAssigned(staff("Jane Doe", "On leave")), true);
  assert.equal(isAssigned(staff("Jane Doe", "Onboarding")), true);
});

test("the most recently started active period wins when periods overlap", () => {
  const base = period("Call 1", "2026-01-01", "2026-12-31");
  const option = period("Call 1.1", "2026-10-01", "2027-09-30");
  assert.equal(effectivePeriod([base, option], "2026-10-15").id, "Call 1.1");
});

test("period selection falls back to the latest prior or earliest upcoming period", () => {
  const old = period("Call 1", "2024-01-01", "2024-12-31");
  const recent = period("Call 1.1", "2025-01-01", "2025-12-31");
  assert.equal(effectivePeriod([old, recent], "2026-10-15").id, "Call 1.1");

  const later = period("Call 1.2", "2027-10-01", "2028-09-30");
  const next = period("Call 1.1", "2027-01-01", "2027-09-30");
  assert.equal(effectivePeriod([later, next], "2026-10-15").id, "Call 1.1");
});

test("people rollups count only assigned staff in the effective period", () => {
  const base = period("Call 1", "2025-01-01", "2025-12-31", [
    staff("Historical Person", "Assigned"),
    staff("Another Historical Person", "Assigned"),
  ]);
  const current = period("Call 1.1", "2026-01-01", "2026-12-31", [
    staff("Current Person", "Assigned"),
    staff("Open Position", "Vacant"),
  ]);

  const groups = groupCallOrders([base, current], "2026-10-15");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].current.id, "Call 1.1");
  assert.equal(filled(groups[0].current), 1);
});
