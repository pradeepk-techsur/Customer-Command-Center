export function normalizeCurrency(value: unknown, allowNegative = false): string | null {
  const raw = String(value ?? "").trim().replace(/[$,\s]/g, "");
  const pattern = allowNegative ? /^-?\d+(?:\.\d{1,2})?$/ : /^\d+(?:\.\d{1,2})?$/;
  if (!pattern.test(raw)) return null;

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [wholePart, fractionPart = ""] = unsigned.split(".");
  const whole = wholePart.replace(/^0+(?=\d)/, "");
  if (whole.length > 12) return null;

  const normalized = `${whole}.${fractionPart.padEnd(2, "0")}`;
  return negative && normalized !== "0.00" ? `-${normalized}` : normalized;
}

export function currencyNumber(value: unknown, allowNegative = false): number | null {
  const normalized = normalizeCurrency(value, allowNegative);
  return normalized === null ? null : Number(normalized);
}
