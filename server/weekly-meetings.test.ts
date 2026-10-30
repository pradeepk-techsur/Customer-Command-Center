import assert from "node:assert/strict";
import test from "node:test";
import { validIsoDate, validateMeetingActionInput, validateMeetingInput } from "./routes/weekly-meetings.ts";

test("weekly meeting validation requires a real date and agenda", () => {
  assert.equal(validIsoDate("2026-02-29"), false);
  assert.equal(validIsoDate("2028-02-29"), true);
  assert.deepEqual(validateMeetingInput({ meetingDate: "2026-10-28", agenda: "  Review delivery  " }), {
    meetingDate: "2026-10-28", agenda: "Review delivery",
  });
  assert.equal(validateMeetingInput({ meetingDate: "2026-10-28", agenda: " " }), null);
});

test("meeting actions require both description and free-form assignee", () => {
  assert.deepEqual(validateMeetingActionInput({ description: "  Send minutes ", assignedTo: " Joan " }), {
    description: "Send minutes", assignedTo: "Joan",
  });
  assert.equal(validateMeetingActionInput({ description: "Send minutes", assignedTo: "" }), null);
  assert.equal(validateMeetingActionInput({ description: "", assignedTo: "Joan" }), null);
});
