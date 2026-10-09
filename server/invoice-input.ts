import type { InvoiceCreateInput } from "../shared/types.ts";
import { currencyNumber } from "../shared/money.ts";

export interface NormalizedInvoiceInput {
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function money(value: unknown): number | null {
  return currencyNumber(value);
}

export function validateInvoiceInput(
  input: Partial<InvoiceCreateInput>,
): { value?: NormalizedInvoiceInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const invoiceNumber = String(input.invoiceNumber ?? "").trim();
  const invoiceDate = String(input.invoiceDate ?? "").trim();
  const periodStart = String(input.periodStart ?? "").trim();
  const periodEnd = String(input.periodEnd ?? "").trim();
  const amount = money(input.amount);

  if (!invoiceNumber) errors.invoiceNumber = "Invoice number is required.";
  if (!validIsoDate(invoiceDate)) errors.invoiceDate = "Enter a valid invoice date.";
  if (amount === null) errors.amount = "Enter a non-negative amount with no more than two decimal places.";
  if (!validIsoDate(periodStart)) errors.periodStart = "Enter a valid billing period start date.";
  if (!validIsoDate(periodEnd)) errors.periodEnd = "Enter a valid billing period end date.";
  if (validIsoDate(periodStart) && validIsoDate(periodEnd) && periodEnd < periodStart) {
    errors.periodEnd = "Billing period end must be on or after the start date.";
  }

  if (Object.keys(errors).length || amount === null) return { errors };
  return {
    errors,
    value: { invoiceNumber, invoiceDate, amount, periodStart, periodEnd },
  };
}
