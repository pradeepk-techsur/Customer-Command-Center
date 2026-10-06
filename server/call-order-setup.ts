import type { CallOrderSetupInput } from "../shared/types.ts";

export interface NormalizedCallOrderSetup {
  id?: string;
  groupKey?: string;
  name: string;
  description: string;
  narrative: string;
  popStart: string;
  popEnd: string;
  funded: number;
  spend: number;
  eac: number | null;
  overUnder: number | null;
  pm: string;
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function money(value: unknown, fallback: number | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCallNumber(value: unknown): { id: string; groupKey: string } | null {
  const match = String(value ?? "").trim().match(/^(?:Call\s*)?0*(\d+)(?:\.0*(\d+))?$/i);
  if (!match) return null;
  const number = Number(match[1]);
  const period = match[2] === undefined ? null : Number(match[2]);
  if (!Number.isSafeInteger(number) || number < 1 || (period !== null && (!Number.isSafeInteger(period) || period < 1))) return null;
  return {
    id: `Call ${number}${period === null ? "" : `.${period}`}`,
    groupKey: `Call ${String(number).padStart(3, "0")}`,
  };
}

export function validateCallOrderSetup(
  input: Partial<CallOrderSetupInput>,
  requireCallNumber: boolean,
): { value?: NormalizedCallOrderSetup; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const callNumber = normalizeCallNumber(input.callNumber);
  const name = String(input.name ?? "").trim();
  const popStart = String(input.popStart ?? "").trim();
  const popEnd = String(input.popEnd ?? "").trim();
  const funded = money(input.funded, 0);
  const spend = money(input.spend, 0);
  const eac = money(input.eac, null);
  const overUnder = money(input.overUnder, null);

  if (requireCallNumber && !callNumber) errors.callNumber = "Enter a call-order ID such as Call 13 or Call 13.1.";
  if (!name) errors.name = "Call-order name is required.";
  if (!validIsoDate(popStart)) errors.popStart = "Enter a valid period start date.";
  if (!validIsoDate(popEnd)) errors.popEnd = "Enter a valid period end date.";
  if (validIsoDate(popStart) && validIsoDate(popEnd) && popEnd < popStart) errors.popEnd = "Period end must be on or after the start date.";
  if (funded === null || funded < 0) errors.funded = "Funding must be a non-negative amount.";
  if (spend === null || spend < 0) errors.spend = "Spend must be a non-negative amount.";
  if (String(input.eac ?? "").trim() && (eac === null || eac < 0)) errors.eac = "EAC must be a non-negative amount.";
  if (String(input.overUnder ?? "").trim() && overUnder === null) errors.overUnder = "Over/under must be a valid amount.";

  if (Object.keys(errors).length || funded === null || spend === null) return { errors };
  return {
    errors,
    value: {
      ...(callNumber ?? {}),
      name,
      description: String(input.description ?? "").trim(),
      narrative: String(input.narrative ?? "").trim(),
      popStart,
      popEnd,
      funded,
      spend,
      eac,
      overUnder,
      pm: String(input.pm ?? "").trim() || "Unassigned",
    },
  };
}
