/** Extracts award/modification fields from an uploaded contract file so no manual data entry is required. */
// @ts-expect-error -- no declaration file for the internal pdf-parse/lib subpath (see invoice-parser.ts)
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

export interface ParsedContractDocument {
  name: string | null;
  effectiveDate: string | null;   // YYYY-MM-DD
  isAdminMod: boolean;
  isFundingMod: boolean;
  fundingChangeAmount: number | null;
  popPeriodLabel: string | null;  // "Base", "Option 1", "Option 2", ...
}

function toIsoDate(mdy: string | null | undefined): string | null {
  if (!mdy) return null;
  const m = mdy.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${year}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
  }
  const t = Date.parse(mdy);
  return isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function toAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

/** Extracts plain text from a PDF or DOCX buffer. Returns "" for unsupported types. */
async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === "application/pdf") {
    const { text } = await pdfParse(buffer);
    return text;
  }
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  return "";
}

/** Parses an award or modification document (PDF/DOCX). Returns whatever fields it can find; a base award has no modification number. */
export async function parseContractDocument(buffer: Buffer, mimetype: string): Promise<ParsedContractDocument> {
  const text = await extractText(buffer, mimetype);
  if (!text) {
    return { name: null, effectiveDate: null, isAdminMod: false, isFundingMod: false, fundingChangeAmount: null, popPeriodLabel: null };
  }

  const modNumber = text.match(/(?:Modification|Amendment)\s*(?:No\.?|Number)\s*:?\s*([A-Za-z0-9\-]+)/i)?.[1] ?? null;
  const name = modNumber ? `Modification ${modNumber}` : /base\s+award|award\s+document/i.test(text) ? "Base Award" : null;

  const effectiveDate = toIsoDate(text.match(/Effective Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1]);

  const isAdminMod = /administrative\s+(change|modification)/i.test(text);

  const fundingMatch = text.match(/(?:increase|decrease|change)\s+(?:in\s+)?(?:the\s+)?(?:contract\s+)?(?:value|price|amount|funding)[^$\n]*\$\s?([\d,]+\.\d{2})/i)
    ?? text.match(/(?:funding|obligated)\s+(?:amount|change)\s*:?\s*\$?\s?([\d,]+\.\d{2})/i);
  const isDecrease = /decrease/i.test(fundingMatch?.[0] ?? "");
  const isFundingMod = !!fundingMatch;
  const fundingChangeAmount = isFundingMod ? (toAmount(fundingMatch![1]) ?? null) && (isDecrease ? -Math.abs(toAmount(fundingMatch![1])!) : toAmount(fundingMatch![1])) : null;

  const periodMatch = text.match(/\bBase\s+Period\b/i) ? "Base"
    : text.match(/\bOption\s+(?:Period|Year)\s*(\d+)\b/i)
    ? `Option ${text.match(/\bOption\s+(?:Period|Year)\s*(\d+)\b/i)![1]}`
    : null;

  return { name, effectiveDate, isAdminMod, isFundingMod, fundingChangeAmount, popPeriodLabel: periodMatch };
}
