import assert from "node:assert/strict";
import test from "node:test";
import { parseCallOrderAwardText } from "./call-order-award-parser.ts";

test("extracts reviewed setup fields from an OF-347 call-order award", () => {
  const result = parseCallOrderAwardText(`
    1. DATE OF ORDER
    09/25/2026
    3. ORDER NUMBER
    USCA26BPAC2083
    Grand Total: $5,447,029.88
    C-1Enterprise Architecture Support
    3. Scope of Work
    The Judiciary requires contractor support for its Enterprise Architecture Program.
    4. Requirements
    Period of Performance: 09/25/2026 - 09/24/2027
  `);

  assert.equal(result.externalOrderNumber, "USCA26BPAC2083");
  assert.equal(result.awardDate, "2026-09-25");
  assert.equal(result.draft.name, "Enterprise Architecture Support");
  assert.equal(result.draft.description, "The Judiciary requires contractor support for its Enterprise Architecture Program.");
  assert.equal(result.draft.popStart, "2026-09-25");
  assert.equal(result.draft.popEnd, "2027-09-24");
  assert.equal(result.draft.funded, "5447029.88");
  assert.deepEqual(result.warnings, []);
});

test("returns review warnings instead of inventing missing award values", () => {
  const result = parseCallOrderAwardText("ORDER FOR SUPPLIES OR SERVICES");
  assert.equal(result.draft.name, "");
  assert.equal(result.draft.funded, "");
  assert.ok(result.warnings.length >= 3);
});
