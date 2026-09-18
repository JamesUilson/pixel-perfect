/**
 * Number and date formatting, Uzbekistan conventions.
 *
 * Money is formatted WITHOUT `Intl`, deliberately. The grouping separator for
 * ru-RU differs between ICU versions — U+00A0 on one runtime, U+202F on
 * another — so a price rendered on the server and re-rendered in the browser
 * can differ by one invisible character and blow up hydration. Grouping by hand
 * is three lines and always produces the same string everywhere.
 */

// Built from a string so a formatter cannot turn the escapes into the literal
// invisible characters they describe.
const NBSP_CLASS = new RegExp("[\u00A0\u202F\u2009]", "g");

/** 285000 -> "285 000" (plain U+0020 spaces, identical on every runtime). */
export function groupDigits(value: number): string {
  const sign = value < 0 ? "-" : "";
  const digits = Math.abs(Math.round(value)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatSom(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return `${groupDigits(n)} so'm`;
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(".0", "")}K`;
  return String(value);
}

export function formatKm(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${groupDigits(value)} km`;
}

/** Month names spelled out, so dates do not depend on the runtime's ICU data either. */
const MONTHS_UZ = [
  "yan",
  "fev",
  "mar",
  "apr",
  "may",
  "iyn",
  "iyl",
  "avg",
  "sen",
  "okt",
  "noy",
  "dek",
];
const MONTHS_RU = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

export function formatDate(iso: string, lang: "uz" | "ru" = "uz"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const months = lang === "uz" ? MONTHS_UZ : MONTHS_RU;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(iso: string, lang: "uz" | "ru" = "uz"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(iso, lang)}, ${hh}:${mm}`;
}

/** "+998901234567" -> "+998 90 123 45 67" */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length !== 12) return raw;
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
}

/** Normalise any exotic space a pasted string may carry. */
export function normaliseSpaces(value: string): string {
  return value.replace(NBSP_CLASS, " ");
}
