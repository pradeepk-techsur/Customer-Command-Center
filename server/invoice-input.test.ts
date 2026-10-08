import assert from "node:assert/strict";
import test from "node:test";
import { validateInvoiceInput } from "./invoice-input.ts";

test("validates and normalizes a complete invoice", () => {
  const result = validateInvoiceInput({
    invoiceNumber: " INV-2048 ",
    invoiceDate: "2026-09-30",
    amount: "$12,345.67",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
  });

  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.value, {
    invoiceNumber: "INV-2048",
    invoiceDate: "2026-09-30",
    amount: 12345.67,
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
  });
});

test("requires every invoice detail", () => {
  const result = validateInvoiceInput({});

  assert.ok(result.errors.invoiceNumber);
  assert.ok(result.errors.invoiceDate);
  assert.ok(result.errors.amount);
  assert.ok(result.errors.periodStart);
  assert.ok(result.errors.periodEnd);
});

test("rejects invalid amounts and billing periods", () => {
  const result = validateInvoiceInput({
    invoiceNumber: "INV-2048",
    invoiceDate: "2026-02-30",
    amount: "10.999",
    periodStart: "2026-10-01",
    periodEnd: "2026-09-01",
  });

  assert.ok(result.errors.invoiceDate);
  assert.ok(result.errors.amount);
  assert.ok(result.errors.periodEnd);
});
