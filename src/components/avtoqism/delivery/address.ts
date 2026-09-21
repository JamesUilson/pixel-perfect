/**
 * The rules the delivery forms share with the server.
 *
 * Every constant here has a counterpart in the API — the Uzbekistan bounding
 * box, the three-day promise, the pair rule for coordinates. They are repeated
 * on this side so a buyer is corrected while they type instead of being bounced
 * by a 422 after they have pressed the button. The server still decides.
 */
import { ApiError } from "@/lib/api/client";
import type { AddressOut } from "@/lib/query/addresses";

/** Uzbek mobile numbers, in any of the shapes people actually type. */
export const PHONE_RE = /^\+?998\d{9}$|^\d{9}$/;

/** "90 123 45 67" and "+998901234567" both end up as "+998901234567". */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 9 ? `+998${digits}` : `+${digits}`;
}

/** `app/core/geo.py`: generous edges, enough to catch a swapped pair. */
export const UZ_LAT = { min: 37, max: 46 } as const;
export const UZ_LNG = { min: 55, max: 74 } as const;

/** Where the map opens before anything is picked: central Tashkent. */
export const DEFAULT_CENTER = { lat: 41.311081, lng: 69.240562 } as const;

/** `app/modules/orders/stages.py`. Calendar days, not working days. */
export const PROMISE_DAYS = 3;

export function promisedDateFromNow(now: Date = new Date()): Date {
  const due = new Date(now.getTime());
  due.setDate(due.getDate() + PROMISE_DAYS);
  return due;
}

/**
 * `promised_date` is a calendar day, not an instant. Handing `2026-09-24`
 * straight to `new Date` parses it as UTC midnight, which is the day before in
 * any negative-offset runtime; pinning it to local midday cannot slip.
 */
export function calendarDayIso(dateOnly: string): string {
  return dateOnly.includes("T") ? dateOnly : `${dateOnly}T12:00:00`;
}

/** A Date as the calendar day it is in the viewer's own timezone. */
export function localDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Six decimals is about 11cm — more than a courier will ever need. */
export function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

export function parseCoordinate(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function insideUzbekistan(lat: number, lng: number): boolean {
  return lat >= UZ_LAT.min && lat <= UZ_LAT.max && lng >= UZ_LNG.min && lng <= UZ_LNG.max;
}

/* --- the address itself ----------------------------------------------------- */

/** The separate, labelled pieces. "podyezd 3" in the street box is invisible to
 *  the driver, so each one gets its own field all the way down to the payload. */
export type AddressParts = {
  region: string;
  district: string;
  street: string;
  house: string;
  entrance: string;
  floor: string;
  apartment: string;
  landmark: string;
  /** Kept as typed text so a half-entered pair can be shown back unchanged. */
  lat: string;
  lng: string;
};

export function emptyAddressParts(): AddressParts {
  return {
    region: "Toshkent",
    district: "",
    street: "",
    house: "",
    entrance: "",
    floor: "",
    apartment: "",
    landmark: "",
    lat: "",
    lng: "",
  };
}

export function addressPartsOf(address: AddressOut): AddressParts {
  const lat = parseCoordinate(address.lat);
  const lng = parseCoordinate(address.lng);
  return {
    region: address.region,
    district: address.district,
    street: address.street,
    house: address.house ?? "",
    entrance: address.entrance ?? "",
    floor: address.floor ?? "",
    apartment: address.apartment ?? "",
    landmark: address.landmark ?? "",
    lat: lat === null ? "" : formatCoordinate(lat),
    lng: lng === null ? "" : formatCoordinate(lng),
  };
}

/** Trimmed, with every blank optional field turned into the null the API wants. */
export function addressPartsToPayload(parts: AddressParts) {
  const text = (value: string) => {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };
  return {
    region: parts.region.trim(),
    district: parts.district.trim(),
    street: parts.street.trim(),
    house: text(parts.house),
    entrance: text(parts.entrance),
    floor: text(parts.floor),
    apartment: text(parts.apartment),
    landmark: text(parts.landmark),
    lat: parseCoordinate(parts.lat),
    lng: parseCoordinate(parts.lng),
  };
}

export type FieldErrors = Record<string, string>;

/** Mirrors `AddressIn`. The keys match the form field names, so a message lands
 *  under the input that caused it. */
export function validateAddressParts(parts: AddressParts): FieldErrors {
  const errors: FieldErrors = {};
  if (parts.region.trim().length < 2) errors["region"] = "Viloyatni kiriting";
  if (parts.district.trim().length < 2) errors["district"] = "Tumanni kiriting";
  if (parts.street.trim().length < 3) errors["street"] = "Ko'cha nomini kiriting";

  const latTyped = parts.lat.trim() !== "";
  const lngTyped = parts.lng.trim() !== "";
  if (latTyped !== lngTyped) {
    // The same rule as `AddressIn._coordinates_come_in_pairs`, caught here so
    // the buyer is not bounced by a 422 for a field they half-filled.
    errors["coordinates"] = "Xarita nuqtasi to'liq emas: kenglik va uzunlik birga kiritiladi.";
  } else if (latTyped && lngTyped) {
    const lat = parseCoordinate(parts.lat);
    const lng = parseCoordinate(parts.lng);
    if (lat === null || lng === null) {
      errors["coordinates"] = "Koordinatalar raqam bo'lishi kerak.";
    } else if (!insideUzbekistan(lat, lng)) {
      errors["coordinates"] =
        `Bu nuqta O'zbekiston hududidan tashqarida. Kenglik ${UZ_LAT.min}–${UZ_LAT.max}, ` +
        `uzunlik ${UZ_LNG.min}–${UZ_LNG.max} oralig'ida bo'lishi kerak.`;
    }
  }
  return errors;
}

/* --- reading the server's refusal -------------------------------------------- */

/** Pydantic prefixes a model validator's message; the buyer does not need it. */
function cleanReason(reason: string): string {
  return reason.replace(/^Value error,\s*/i, "").trim();
}

type ApiFieldError = { field?: unknown; reason?: unknown };

/**
 * A 422 names the fields it refused. Returned keyed exactly as the server names
 * them — `address.house`, `contact`, or `""` for a whole-body rule — so each
 * form picks out the paths it owns instead of guessing at a shared convention.
 */
export function fieldErrorsFromApi(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return {};
  const raw = error.details?.["fields"];
  if (!Array.isArray(raw)) return {};

  const errors: FieldErrors = {};
  for (const entry of raw as ApiFieldError[]) {
    if (typeof entry?.field !== "string" || typeof entry?.reason !== "string") continue;
    // First one wins: a field named twice is one problem, not two.
    errors[entry.field] ??= cleanReason(entry.reason);
  }
  return errors;
}

/**
 * Server paths mapped onto the form's own field names.
 *
 * `prefix` is where the address sits in the request body: `"address."` at
 * checkout, `""` when the address book posts one on its own. Both halves of a
 * coordinate and the pair rule itself land on `coordinates`, which is where the
 * map picker shows its message.
 */
export function addressErrorsFromApi(apiErrors: FieldErrors, prefix = ""): FieldErrors {
  const at = (field: string) => apiErrors[`${prefix}${field}`];
  const container = prefix ? apiErrors[prefix.replace(/\.$/, "")] : apiErrors[""];

  const errors: FieldErrors = {};
  const simple = [
    "region",
    "district",
    "street",
    "house",
    "entrance",
    "floor",
    "apartment",
    "landmark",
    "recipient_name",
    "phone",
    "label",
  ] as const;
  for (const field of simple) {
    const reason = at(field);
    if (reason) errors[field] = reason;
  }
  const coordinates = at("lat") ?? at("lng") ?? container;
  if (coordinates) errors["coordinates"] = coordinates;
  return errors;
}

/** Everything a 422 complained about, for the banner above the form. */
export function validationSummary(apiErrors: FieldErrors): string[] {
  return Object.values(apiErrors).filter((reason) => reason.length > 0);
}

/**
 * Drop a message the moment its field passes, keep everything still failing.
 *
 * Called as the buyer types, so a correction is acknowledged immediately —
 * and a complaint the server made about a field that has since been edited
 * disappears with it rather than contradicting what is now on screen.
 */
export function pruneErrors(current: FieldErrors, stillFailing: FieldErrors): FieldErrors {
  if (Object.keys(current).length === 0) return current;
  const kept: FieldErrors = {};
  for (const key of Object.keys(current)) {
    const message = stillFailing[key];
    if (message) kept[key] = message;
  }
  return kept;
}
