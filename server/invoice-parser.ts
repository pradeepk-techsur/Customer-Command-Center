/** Extracts invoice fields from an uploaded TechSur invoice PDF so no manual data entry is required. */
// Import the inner lib module directly: the package's index.js runs a self-test using `module.parent`,
// which is unset under tsx/ESM and crashes with ENOENT on import. No types ship for this subpath.
// @ts-expect-error -- no declaration file for the internal pdf-parse/lib subpath
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export interface ParsedInvoice {
  invoiceNumber: string | null;
  invoiceDate: string | null;   // YYYY-MM-DD
  amount: number | null;        // Invoice Total (current period), falls back to Total Funds Expended
  periodEnd: string | null;     // YYYY-MM-DD, from "Billing Thru"
}

function toIsoDate(mdy: string | null | undefined): string | null {
  if (!mdy) return null;
  const m = mdy.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const month = String(m[1]).padStart(2, "0");
  const day = String(m[2]).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

/** Parses a TechSur invoice PDF buffer. Returns whatever fields it can find; callers should treat this as a starting point, not a guarantee. */
export async function parseInvoicePdf(buffer: Buffer): Promise<ParsedInvoice> {
  const { text } = await pdfParse(buffer);

  const invoiceNumber = text.match(/Invoice Number:\s*([A-Za-z0-9\-]+)/)?.[1] ?? null;
  const invoiceDate = toIsoDate(text.match(/Invoice Date:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/)?.[1]);
  const periodEnd = toIsoDate(text.match(/Billing Thru:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/)?.[1]);

  // "Invoice Total:" is followed by the current-period amount, then the cumulative amount.
  const totalMatch = text.match(/Invoice Total:\s*\$?([\d,]+\.\d{2})/);
  const fundsExpendedMatch = text.match(/Total Funds Expended:\s*\$?([\d,]+\.\d{2})/);
  const amount = toAmount(totalMatch?.[1]) ?? toAmount(fundsExpendedMatch?.[1]);

  return { invoiceNumber, invoiceDate, amount, periodEnd };
}
