import type { CallOrderAwardPreview, CallOrderSetupInput } from "../shared/types.ts";
import { extractText } from "./contract-document-parser.ts";

function toIsoDate(value: string | undefined): string | null {
  const match = value?.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return null;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  return `${year}-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
}

function amount(value: string | undefined): string {
  if (!value) return "";
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "";
}

function cleanParagraph(value: string | undefined): string {
  return String(value ?? "")
    .replace(/\b[A-Z0-9-]+\s*-\s*Page\s+\d+\s+of\s+\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCallOrderAwardText(text: string): CallOrderAwardPreview {
  const externalOrderNumber = text.match(/\bORDER NUMBER\s+([A-Z0-9-]+)/i)?.[1] ?? null;
  const awardDate = toIsoDate(text.match(/\bDATE OF ORDER\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1]);
  const title = cleanParagraph(text.match(/\bC-\d+\s*([^\n\r]+)/i)?.[1]);
  const pop = text.match(/Period of Performance\s*:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)
    ?? text.match(/PERIOD OF PERFORMANCE[\s\S]{0,160}?START\s+END[\s\S]{0,80}?(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  const grandTotal = text.match(/Grand Total\s*:\s*\$\s*([\d,]+(?:\.\d{2,4})?)/i)?.[1]
    ?? text.match(/17\(i\)[\s\S]{0,80}?GRAND\s+TOTAL[\s\S]{0,40}?\$\s*([\d,]+(?:\.\d{2})?)/i)?.[1];
  const scope = cleanParagraph(text.match(/\b3\.\s*Scope of Work\s+([\s\S]*?)(?=\n\s*4\.\s*Requirements\b)/i)?.[1]);

  const draft: CallOrderSetupInput = {
    callNumber: "",
    name: title,
    description: scope,
    narrative: "",
    popStart: toIsoDate(pop?.[1]) ?? "",
    popEnd: toIsoDate(pop?.[2]) ?? "",
    funded: amount(grandTotal),
    spend: "0",
    eac: "",
    overUnder: "",
    pm: "",
  };
  const warnings: string[] = [];
  if (!externalOrderNumber) warnings.push("The external order number could not be identified.");
  if (!draft.name) warnings.push("The call-order name could not be identified.");
  if (!draft.popStart || !draft.popEnd) warnings.push("The period of performance could not be identified.");
  if (!draft.funded) warnings.push("The obligated amount could not be identified.");

  return { externalOrderNumber, awardDate, draft, warnings };
}

export async function parseCallOrderAward(buffer: Buffer, mimetype: string): Promise<CallOrderAwardPreview> {
  return parseCallOrderAwardText(await extractText(buffer, mimetype));
}
