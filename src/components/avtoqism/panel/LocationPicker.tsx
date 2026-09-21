/**
 * Where the shop physically is.
 *
 * A buyer taps "open in Navigator" and a driver sets off, so the point matters
 * more than the typed address. Picking it needs no map SDK and no API key: the
 * phone already knows where it is standing, and Yandex serves a map widget in
 * an iframe that anyone can embed. The widget is a preview only — nothing is
 * read back out of it — so a seller who cannot use it can still type the pair.
 *
 * The bounds below are the server's own, repeated here so a swapped lat/lng is
 * caught while the person is still looking at the field rather than after a
 * round trip. The server remains the authority; its 422 is shown as-is.
 */
import { useId, useState } from "react";
import { Crosshair, ExternalLink, MapPin, Navigation, X } from "lucide-react";

import { Button, Field, Input } from "@/components/avtoqism/panel/Widgets";

export type Coordinates = { latitude: string; longitude: string };

/** Uzbekistan's bounding box, generous at the edges. Mirrors `app/core/geo.py`. */
const LAT_RANGE = [37, 46] as const;
const LNG_RANGE = [55, 74] as const;

export const EMPTY_COORDINATES: Coordinates = { latitude: "", longitude: "" };

/** Six decimals is about ten centimetres — far past what a shop door needs. */
function round6(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}

export function coordinatesOf(source: {
  latitude?: string | null;
  longitude?: string | null;
}): Coordinates {
  return { latitude: source.latitude ?? "", longitude: source.longitude ?? "" };
}

function parsed(value: Coordinates): { lat: number; lng: number } | null {
  const lat = Number(value.latitude);
  const lng = Number(value.longitude);
  if (!value.latitude.trim() || !value.longitude.trim()) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** True when both halves are present and land inside the box. */
export function hasPoint(value: Coordinates): boolean {
  const point = parsed(value);
  if (!point) return false;
  return (
    point.lat >= LAT_RANGE[0] &&
    point.lat <= LAT_RANGE[1] &&
    point.lng >= LNG_RANGE[0] &&
    point.lng <= LNG_RANGE[1]
  );
}

/**
 * What is wrong with the pair, in the seller's words, or null when it is fine.
 * An empty pair is fine: the point is optional until the shop wants to be found.
 */
export function coordinateProblem(value: Coordinates): string | null {
  const latGiven = value.latitude.trim() !== "";
  const lngGiven = value.longitude.trim() !== "";
  if (!latGiven && !lngGiven) return null;
  if (latGiven !== lngGiven) {
    return "Xarita nuqtasi to'liq emas: kenglik va uzunlik birga yuboriladi.";
  }
  const point = parsed(value);
  if (!point) return "Koordinatalar faqat raqamlardan iborat bo'ladi. Masalan: 41.311081.";
  if (point.lat < LAT_RANGE[0] || point.lat > LAT_RANGE[1]) {
    return `Kenglik ${LAT_RANGE[0]} va ${LAT_RANGE[1]} orasida bo'ladi. Kenglik va uzunlikni almashtirib yubormadingizmi?`;
  }
  if (point.lng < LNG_RANGE[0] || point.lng > LNG_RANGE[1]) {
    return `Uzunlik ${LNG_RANGE[0]} va ${LNG_RANGE[1]} orasida bo'ladi. Kenglik va uzunlikni almashtirib yubormadingizmi?`;
  }
  return null;
}

/** The pair as the API wants it: both, or neither. */
export function coordinatePayload(value: Coordinates): {
  latitude: string | null;
  longitude: string | null;
} {
  if (!value.latitude.trim() || !value.longitude.trim()) {
    return { latitude: null, longitude: null };
  }
  return { latitude: value.latitude.trim(), longitude: value.longitude.trim() };
}

/**
 * The public map widget. It is the only Yandex URL this file builds, and it
 * builds it because an iframe preview has no server-side counterpart — every
 * link a person can follow comes from the API instead.
 */
function embedUrl(lat: number, lng: number): string {
  return `https://yandex.uz/map-widget/v1/?ll=${lng},${lat}&z=16&pt=${lng},${lat},pm2rdm`;
}

const GEOLOCATION_ERRORS: Record<number, string> = {
  1: "Joylashuvga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering yoki koordinatani qo'lda kiriting.",
  2: "Joylashuvni aniqlab bo'lmadi. Ochiq joyga chiqib qayta urining yoki qo'lda kiriting.",
  3: "Joylashuvni aniqlash cho'zilib ketdi. Qayta urining yoki qo'lda kiriting.",
};

export function LocationPicker({
  value,
  onChange,
  saved,
  serverError,
  disabled = false,
}: {
  value: Coordinates;
  onChange: (value: Coordinates) => void;
  /** The point already stored, with the links the server built for it. */
  saved?:
    | {
        latitude?: string | null;
        longitude?: string | null;
        mapUrl?: string | null;
        navigatorUrl?: string | null;
      }
    | undefined;
  /** A 422 from the API, shown under the fields exactly as the server wrote it. */
  serverError?: string | undefined;
  disabled?: boolean | undefined;
}) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const statusId = useId();

  const problem = coordinateProblem(value);
  const point = hasPoint(value) ? parsed(value) : null;

  // Server links describe the point that was saved. The moment the fields hold
  // something else they would send a driver to the old address, so they go.
  const linksApply =
    saved != null &&
    (saved.latitude ?? "") === value.latitude.trim() &&
    (saved.longitude ?? "") === value.longitude.trim();

  function locate() {
    setGeoError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Bu brauzer joylashuvni aniqlay olmaydi. Koordinatani qo'lda kiriting.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChange({
          latitude: round6(position.coords.latitude),
          longitude: round6(position.coords.longitude),
        });
      },
      (error) => {
        setLocating(false);
        setGeoError(GEOLOCATION_ERRORS[error.code] ?? "Joylashuvni aniqlab bo'lmadi.");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={locate} disabled={disabled || locating}>
          <Crosshair className="size-4" aria-hidden />
          {locating ? "Aniqlanmoqda…" : "Joylashuvimni aniqlash"}
        </Button>
        {(value.latitude || value.longitude) && (
          <Button
            variant="ghost"
            onClick={() => {
              setGeoError(null);
              onChange(EMPTY_COORDINATES);
            }}
            disabled={disabled}
          >
            <X className="size-4" aria-hidden />
            Nuqtani olib tashlash
          </Button>
        )}
      </div>

      <p className="type-caption">
        Telefondan tursangiz, do'kon eshigi oldida turib «Joylashuvimni aniqlash» tugmasini bosing.
        Kompyuterda koordinatani Yandex xaritadan nusxalab qo'yish qulayroq.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kenglik (latitude)" hint="Masalan: 41.311081">
          <Input
            value={value.latitude}
            onChange={(event) => onChange({ ...value, latitude: event.target.value })}
            inputMode="decimal"
            autoComplete="off"
            placeholder="41.311081"
            disabled={disabled}
          />
        </Field>
        <Field label="Uzunlik (longitude)" hint="Masalan: 69.240562">
          <Input
            value={value.longitude}
            onChange={(event) => onChange({ ...value, longitude: event.target.value })}
            inputMode="decimal"
            autoComplete="off"
            placeholder="69.240562"
            disabled={disabled}
          />
        </Field>
      </div>

      <p id={statusId} aria-live="polite" className="sr-only">
        {locating ? "Joylashuv aniqlanmoqda" : point ? "Nuqta belgilandi" : ""}
      </p>

      {geoError && <p className="text-sm text-destructive">{geoError}</p>}
      {problem && <p className="text-sm text-destructive">{problem}</p>}
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      {point ? (
        <div className="border border-border">
          <iframe
            key={`${point.lat},${point.lng}`}
            title="Do'kon joylashuvi xaritada"
            src={embedUrl(point.lat, point.lng)}
            className="block h-64 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3">
            <span className="type-caption inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 text-primary" aria-hidden />
              {point.lat}, {point.lng}
            </span>
            {linksApply && saved?.mapUrl ? (
              <a
                href={saved.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Xaritadagi havola
              </a>
            ) : null}
            {linksApply && saved?.navigatorUrl ? (
              <a
                href={saved.navigatorUrl}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <Navigation className="size-3.5" aria-hidden />
                Navigatorda ochish
              </a>
            ) : null}
            {!linksApply && (
              <span className="type-caption">
                Havola saqlagandan keyin paydo bo'ladi — uni server tayyorlaydi.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-border px-4 py-8 text-center">
          <MapPin className="mx-auto mb-2 size-5 text-muted-foreground" aria-hidden />
          <p className="type-caption">
            Nuqta belgilanmagan. Xaridorlar do'konni xaritadan topa olmaydi.
          </p>
        </div>
      )}
    </div>
  );
}
