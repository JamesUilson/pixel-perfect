/**
 * Card facts the *preview* needs, and nothing else.
 *
 * The BIN rules below are a deliberate copy of `_BIN_RULES` in
 * `app/services/payments/tokens.py`. The server remains the authority: it is
 * what classifies the card that actually gets stored, and what the list of
 * saved cards is rendered from. This copy exists so the brand can appear on the
 * preview while the number is still being typed, before any request has left
 * the browser. A disagreement between the two is therefore a cosmetic bug for
 * the length of one form, never a wrong record — which is the only reason
 * duplicating a rule is acceptable at all. Keep the order identical: it is what
 * makes 5614 an Uzcard rather than falling through to the Mastercard range.
 *
 * Nothing here retains a card number. Every function takes one, reads it and
 * returns a string.
 */
import type { CardBrand } from "@/lib/api/types";

const BIN_RULES: readonly { pattern: RegExp; brand: CardBrand; bank: string }[] = [
  { pattern: /^8600/, brand: "UZCARD", bank: "Uzcard" },
  { pattern: /^5614/, brand: "UZCARD", bank: "Uzcard" },
  { pattern: /^9860/, brand: "HUMO", bank: "Humo" },
  { pattern: /^4[0-9]{3}/, brand: "VISA", bank: "Visa" },
  { pattern: /^(5[1-5]|2[2-7])/, brand: "MASTERCARD", bank: "Mastercard" },
];

/** How a brand is written on the preview. Plain text — never a network's logo. */
export const BRAND_LABEL: Record<CardBrand, string> = {
  UZCARD: "Uzcard",
  HUMO: "Humo",
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  UNKNOWN: "Karta",
};

export function classifyCard(number: string): { brand: CardBrand; bank: string } {
  const digits = cardDigits(number);
  for (const rule of BIN_RULES) {
    if (rule.pattern.test(digits)) return { brand: rule.brand, bank: rule.bank };
  }
  return { brand: "UNKNOWN", bank: "Noma'lum bank" };
}

/** The server accepts 12–19 digits; anything longer is a slip, not a card. */
export const MAX_CARD_DIGITS = 19;
export const MIN_CARD_DIGITS = 12;

export function cardDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, MAX_CARD_DIGITS);
}

/** Groups of four while typing, so the eye can check the number against the card. */
export function groupCardNumber(raw: string): string {
  const groups = cardDigits(raw).match(/.{1,4}/g);
  return groups ? groups.join(" ") : "";
}

/** "09/30" for a list row. Empty when either half is missing. */
export function expiryLabel(
  month: number | null | undefined,
  year: number | null | undefined,
): string {
  if (!month || !year) return "";
  return `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`;
}

/**
 * The twelve months, named.
 *
 * A bare "07" asks the person to translate the number they read off the card
 * into a position in a list; the name removes that step and makes a mis-tap
 * visible at a glance. The value is what goes on the wire — `Number("07")` is
 * 7, which is what `expires_month` expects.
 */
export const EXPIRY_MONTHS: readonly { value: string; label: string }[] = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
].map((name, index) => {
  const value = String(index + 1).padStart(2, "0");
  return { value, label: `${value} — ${name}` };
});

/** This year and the nine after it: past a decade no bank is still issuing. */
export function expiryYears(count = 10, from: number = new Date().getFullYear()): number[] {
  return Array.from({ length: count }, (_, index) => from + index);
}
