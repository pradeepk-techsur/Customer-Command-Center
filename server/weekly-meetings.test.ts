import assert from "node:assert/strict";
import test from "node:test";
import { validIsoDate, validateMeetingActionInput, validateMeetingActions, validateMeetingInput } from "./routes/weekly-meetings.ts";

test("weekly meeting validation requires a real date and agenda", () => {
  assert.equal(validIsoDate("2026-02-29"), false);
  assert.equal(validIsoDate("2028-02-29"), true);
  assert.deepEqual(validateMeetingInput({ meetingDate: "2026-10-28", agenda: "  Review delivery  " }), {
    meetingDate: "2026-10-28", agenda: "Review delivery",
  });
  assert.equal(validateMeetingInput({ meetingDate: "2026-10-28", agenda: " " }), null);
});

test("meeting actions match call-order action item validation", () => {
  assert.deepEqual(validateMeetingActionInput({ name: " Joan ", description: "  Send minutes " }), {
    name: "Joan", description: "Send minutes",
  });
  assert.deepEqual(validateMeetingActionInput({ name: "Joan", description: "" }), {
    name: "Joan", description: null,
  });
  assert.equal(validateMeetingActionInput({ name: "", description: "Send minutes" }), null);
});

test("a meeting can save its action items in the same request", () => {
  assert.deepEqual(validateMeetingActions({ actions: [
    { name: " Joan ", description: " Send minutes " },
    { name: "Paul", description: "" },
  ] }), [
    { name: "Joan", description: "Send minutes" },
    { name: "Paul", description: null },
  ]);
  assert.deepEqual(validateMeetingActions({}), []);
  assert.equal(validateMeetingActions({ actions: [{ name: "", description: "Missing owner" }] }), null);
});
