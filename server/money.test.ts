import assert from "node:assert/strict";
import test from "node:test";
import { currencyNumber, normalizeCurrency } from "../shared/money.ts";

test("normalizes dollar values to two decimal places", () => {
  assert.equal(normalizeCurrency("0"), "0.00");
  assert.equal(normalizeCurrency("0.1"), "0.10");
  assert.equal(normalizeCurrency("$1,234.56"), "1234.56");
  assert.equal(normalizeCurrency("00012.30"), "12.30");
  assert.equal(currencyNumber("$1,234.56"), 1234.56);
});

test("rejects invalid or unsupported dollar values", () => {
  assert.equal(normalizeCurrency(""), null);
  assert.equal(normalizeCurrency("-1.00"), null);
  assert.equal(normalizeCurrency("10.999"), null);
  assert.equal(normalizeCurrency("1.2.3"), null);
  assert.equal(normalizeCurrency("1e3"), null);
  assert.equal(normalizeCurrency("1234567890123.00"), null);
});

test("allows signed currency only when requested", () => {
  assert.equal(normalizeCurrency("-$10.50", true), "-10.50");
  assert.equal(normalizeCurrency("-0.00", true), "0.00");
});
