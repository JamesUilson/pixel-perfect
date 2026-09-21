/**
 * The registration rules the server applies, restated here so the form can say
 * them before the server has to.
 *
 * Every function in this file is a mirror of one in
 * `app/modules/auth/validators.py`, down to the Uzbek wording, and that is the
 * point: a person should never be bounced by the API for something the form was
 * in a position to tell them. The server stays the authority — when it refuses,
 * its message is what gets shown — but it should be refusing surprises, not
 * things the browser already knew.
 *
 * Keeping the copy honest: if `validators.py` changes, this changes with it.
 */

/** `settings.PASSWORD_MIN_LENGTH`. */
export const PASSWORD_MIN_LENGTH = 8;

/** `settings.OTP_MAX_ATTEMPTS` — how many wrong codes before the lock. */
export const OTP_MAX_ATTEMPTS = 5;

/** `settings.OTP_RESEND_COOLDOWN_SECONDS`, used only until the server says otherwise. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** `UZ_REGIONS` — the list the address book and the seller profile also use. */
export const UZ_REGIONS = [
  "Toshkent",
  "Toshkent viloyati",
  "Andijon",
  "Buxoro",
  "Farg'ona",
  "Jizzax",
  "Xorazm",
  "Namangan",
  "Navoiy",
  "Qashqadaryo",
  "Qoraqalpog'iston",
  "Samarqand",
  "Sirdaryo",
  "Surxondaryo",
] as const;

/** `UZ_MOBILE_PREFIXES` — operator codes actually issued in Uzbekistan. */
const UZ_MOBILE_PREFIXES = new Set([
  "20",
  "33",
  "50",
  "55",
  "77",
  "88",
  "90",
  "91",
  "93",
  "94",
  "95",
  "97",
  "98",
  "99",
]);

/** `COMMON_PASSWORDS`. Small on purpose — this is the lazy-password list, not a dictionary. */
const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "87654321",
  "11111111",
  "00000000",
  "qwerty123",
  "qwertyui",
  "password",
  "password1",
  "password123",
  "parol123",
  "parol1234",
  "parolparol",
  "avtoqism",
  "avtoqism1",
  "uzbekistan",
  "toshkent1",
  "iloveyou",
  "admin123",
  "letmein1",
  "asdfghjk",
  "1q2w3e4r",
  "zxcvbnm1",
]);

/**
 * `normalise_uz_phone` — `+998XXXXXXXXX`, or null when this is not a plausible
 * Uzbek mobile number.
 *
 * Accepts every spelling a person uses: `901234567`, `90 123 45 67`,
 * `+998 90 123 45 67`, `998901234567`, `8 90 123 45 67` (the old trunk prefix)
 * and `00998…`. A landline, a foreign code or an unissued operator code is
 * refused here rather than discovered when the SMS never arrives.
 */
export function normaliseUzPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00998")) digits = digits.slice(2);

  let national: string;
  if (digits.length === 12 && digits.startsWith("998")) national = digits.slice(3);
  else if (digits.length === 10 && (digits[0] === "0" || digits[0] === "8"))
    national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  else return null;

  if (!UZ_MOBILE_PREFIXES.has(national.slice(0, 2))) return null;
  return `+998${national}`;
}

/** `+998901234567` → `+998 90 123 45 67`, the way the canonical form is read aloud. */
export function prettyUzPhone(canonical: string): string {
  const d = canonical.replace(/\D/g, "");
  if (d.length !== 12) return canonical;
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
}

/**
 * `looks_like_phone` — does this person mean a number or an address? Decided on
 * shape, before any normalisation, exactly as the server decides it.
 */
export function looksLikePhone(raw: string): boolean {
  return !raw.includes("@") && /\d/.test(raw);
}

/** A shape check only; the server owns deliverability. */
export function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

/**
 * `password_problems` — everything wrong with this password, in Uzbek, named.
 *
 * A list rather than a boolean, for the reason the server gives: "parol juda
 * oddiy" tells nobody what to change, and a person who cannot tell what is
 * wrong picks something worse.
 */
export function passwordProblems(
  password: string,
  context: {
    phone?: string | null | undefined;
    email?: string | null | undefined;
    fullName?: string | null | undefined;
  } = {},
): string[] {
  const problems: string[] = [];
  const lowered = password.toLowerCase();

  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`Parol kamida ${PASSWORD_MIN_LENGTH} ta belgidan iborat bo'lishi kerak.`);
  }
  if (password.length > 128) {
    problems.push("Parol 128 ta belgidan uzun bo'lmasligi kerak.");
  }
  if (/^\d+$/.test(password)) {
    problems.push("Parol faqat raqamlardan iborat bo'lmasligi kerak.");
  } else if (password.length > 0 && /^[^\W\d_]+$/u.test(password)) {
    problems.push("Parolda kamida bitta raqam bo'lishi kerak.");
  }
  if (COMMON_PASSWORDS.has(lowered)) {
    problems.push("Bu parol juda ko'p ishlatiladi. Boshqa parol tanlang.");
  }
  if (context.phone) {
    const digits = context.phone.replace(/\D/g, "");
    const pwdDigits = password.replace(/\D/g, "");
    // Seven digits from the number *is* the number; shorter overlaps happen by
    // accident in perfectly good passwords and refusing those teaches nothing.
    if (digits && pwdDigits.length >= 7 && digits.includes(pwdDigits)) {
      problems.push("Parol telefon raqamingiz bo'lishi mumkin emas.");
    }
  }
  if (context.email) {
    const local = context.email.split("@")[0]?.toLowerCase() ?? "";
    if (local.length >= 4 && lowered.includes(local)) {
      problems.push("Parolda e-pochta manzilingiz bo'lmasligi kerak.");
    }
  }
  if (context.fullName) {
    for (const part of context.fullName.toLowerCase().split(/\s+/)) {
      if (part.length >= 4 && lowered.includes(part)) {
        problems.push("Parolda ismingiz bo'lmasligi kerak.");
        break;
      }
    }
  }
  return problems;
}

/**
 * A rough strength reading for the meter, from the rules above only.
 *
 * Deliberately not an entropy estimate: the bar is there to show that the four
 * named requirements are met, and a score the server does not share would just
 * be a second opinion nobody can act on.
 */
export function passwordStrength(password: string, problems: string[]): 0 | 1 | 2 | 3 {
  if (password === "") return 0;
  if (problems.length > 0) return 1;
  if (password.length >= 12 && /[^\w\s]/.test(password)) return 3;
  return 2;
}

/**
 * The problems the server named, when it refused a password.
 *
 * `assert_password_ok` puts the first one in the message and all of them in
 * `details.problems`, so the form can underline every field at fault instead of
 * showing one line and hiding the rest.
 */
export function serverPasswordProblems(details: Record<string, unknown> | undefined): string[] {
  const raw = details?.["problems"];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}

/**
 * `resend_cooldown` carries how long is left in `details.retry_after_seconds`.
 * Returns null when this error is something else.
 */
export function retryAfterSeconds(
  code: string,
  details: Record<string, unknown> | undefined,
): number | null {
  if (code !== "resend_cooldown") return null;
  const raw = details?.["retry_after_seconds"];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}
