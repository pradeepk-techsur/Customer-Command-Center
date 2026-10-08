import assert from "node:assert/strict";
import test from "node:test";
import { parseInvoiceText } from "./invoice-parser.ts";

test("extracts invoice fields and a complete billing period", () => {
  const result = parseInvoiceText(`
    Invoice Number: INV-2048
    Invoice Date: 09/30/2026
    Billing Period: 09/01/2026 - 09/30/2026
    Invoice Total: $12,345.67
  `);

  assert.deepEqual(result, {
    invoiceNumber: "INV-2048",
    invoiceDate: "2026-09-30",
    amount: 12345.67,
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
  });
});

test("extracts billing-through and cumulative fallback values", () => {
  const result = parseInvoiceText(`
    Invoice Number: 2049
    Invoice Date: 9/30/26
    Billing Thru: 9/30/26
    Total Funds Expended: $8,100.00
  `);

  assert.equal(result.amount, 8100);
  assert.equal(result.periodStart, null);
  assert.equal(result.periodEnd, "2026-09-30");
});

test("does not return impossible dates", () => {
  const result = parseInvoiceText("Invoice Date: 02/30/2026 Billing Thru: 13/01/2026");
  assert.equal(result.invoiceDate, null);
  assert.equal(result.periodEnd, null);
});
