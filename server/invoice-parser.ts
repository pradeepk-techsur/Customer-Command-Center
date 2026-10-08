/** Extracts draft invoice fields from an uploaded TechSur invoice PDF for user review. */
// Import the inner lib module directly: the package's index.js runs a self-test using `module.parent`,
// which is unset under tsx/ESM and crashes with ENOENT on import. No types ship for this subpath.
// @ts-expect-error -- no declaration file for the internal pdf-parse/lib subpath
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export interface ParsedInvoice {
  invoiceNumber: string | null;
  invoiceDate: string | null;   // YYYY-MM-DD
  amount: number | null;        // Invoice Total (current period), falls back to Total Funds Expended
  periodStart: string | null;
  periodEnd: string | null;     // YYYY-MM-DD, from "Billing Thru"
}

function toIsoDate(mdy: string | null | undefined): string | null {
  if (!mdy) return null;
  const m = mdy.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const month = String(m[1]).padStart(2, "0");
  const day = String(m[2]).padStart(2, "0");
  const value = `${year}-${month}-${day}`;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function toAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

/** Extracts fields from PDF text. Every value remains reviewable before an invoice is created. */
export function parseInvoiceText(text: string): ParsedInvoice {
  const invoiceNumber = text.match(/Invoice Number:\s*([A-Za-z0-9\-]+)/)?.[1] ?? null;
  const invoiceDate = toIsoDate(text.match(/Invoice Date:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/)?.[1]);
  const billingPeriod = text.match(/Billing Period:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:-|to|through)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  const periodStart = toIsoDate(
    billingPeriod?.[1] ?? text.match(/Billing (?:From|Start):\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1],
  );
  const periodEnd = toIsoDate(
    text.match(/Billing Thru:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1] ?? billingPeriod?.[2],
  );

  // "Invoice Total:" is followed by the current-period amount, then the cumulative amount.
  const totalMatch = text.match(/Invoice Total:\s*\$?([\d,]+\.\d{2})/);
  const fundsExpendedMatch = text.match(/Total Funds Expended:\s*\$?([\d,]+\.\d{2})/);
  const amount = toAmount(totalMatch?.[1]) ?? toAmount(fundsExpendedMatch?.[1]);

  return { invoiceNumber, invoiceDate, amount, periodStart, periodEnd };
}

/** Parses a TechSur invoice PDF buffer. Returns whatever fields it can find; callers must require user review. */
export async function parseInvoicePdf(buffer: Buffer): Promise<ParsedInvoice> {
  const { text } = await pdfParse(buffer);
  return parseInvoiceText(text);
}
