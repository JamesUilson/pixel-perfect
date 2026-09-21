/**
 * Picking the point on the map, without a map SDK.
 *
 * The founder drives the parcels himself, so a pin is worth more than any
 * amount of prose in the street field. What it deliberately is not is a map
 * library: an embedded Yandex widget draws the point, and the point itself is
 * set either by the browser's own geolocation or by typing the pair. No API
 * key, no bundle, and the form still works with the map blocked.
 */
import { Crosshair, ExternalLink, Loader2, MapPin, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { TextField } from "./Fields";
import {
  DEFAULT_CENTER,
  UZ_LAT,
  UZ_LNG,
  formatCoordinate,
  insideUzbekistan,
  parseCoordinate,
} from "./address";

/** The public widget embed — no key, and it renders a marker for `pt`. */
function widgetSrc(lat: number | null, lng: number | null): string {
  if (lat !== null && lng !== null) {
    return `https://yandex.uz/map-widget/v1/?ll=${lng}%2C${lat}&z=17&pt=${lng}%2C${lat}%2Cpm2rdm`;
  }
  return `https://yandex.uz/map-widget/v1/?ll=${DEFAULT_CENTER.lng}%2C${DEFAULT_CENTER.lat}&z=11`;
}

function browseUrl(lat: number | null, lng: number | null): string {
  const centre = lat !== null && lng !== null ? { lat, lng } : DEFAULT_CENTER;
  return `https://yandex.uz/maps/?ll=${centre.lng}%2C${centre.lat}&z=${lat === null ? 12 : 17}`;
}

const GEOLOCATION_MESSAGES: Record<number, string> = {
  1: "Joylashuvga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering yoki koordinatalarni qo'lda kiriting.",
  2: "Joylashuvni aniqlab bo'lmadi. Ochiq joyda qayta urinib ko'ring yoki koordinatalarni qo'lda kiriting.",
  3: "Joylashuvni aniqlash uzoq davom etdi. Qayta urinib ko'ring.",
};

export function MapPointPicker({
  lat,
  lng,
  onChange,
  error,
  disabled = false,
}: {
  /** Raw text, so a half-typed pair survives a re-render unchanged. */
  lat: string;
  lng: string;
  onChange: (next: { lat: string; lng: string }) => void;
  error?: string | undefined;
  disabled?: boolean | undefined;
}) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const parsedLat = parseCoordinate(lat);
  const parsedLng = parseCoordinate(lng);
  const hasPoint = parsedLat !== null && parsedLng !== null;
  const plausible = hasPoint && insideUzbekistan(parsedLat, parsedLng);

  const locate = () => {
    setGeoError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Bu brauzer joylashuvni aniqlay olmaydi. Koordinatalarni qo'lda kiriting.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChange({
          lat: formatCoordinate(position.coords.latitude),
          lng: formatCoordinate(position.coords.longitude),
        });
      },
      (failure) => {
        setLocating(false);
        setGeoError(
          GEOLOCATION_MESSAGES[failure.code] ??
            "Joylashuvni aniqlab bo'lmadi. Koordinatalarni qo'lda kiriting.",
        );
      },
      // A cradle-mounted phone in a courtyard needs the time; a minute-old fix
      // is still the right building.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  const clear = () => {
    setGeoError(null);
    onChange({ lat: "", lng: "" });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">Xaritadagi nuqta</p>
        {hasPoint && !disabled && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
          >
            <X className="size-3.5" /> Nuqtani tozalash
          </button>
        )}
      </div>
      <p className="type-caption mt-1">
        Ixtiyoriy, lekin kuryer eshikni tezroq topadi. Nuqtani aniqlang yoki koordinatalarni
        kiriting.
      </p>

      <div className="mt-4 overflow-hidden border border-border bg-muted">
        <iframe
          key={widgetSrc(parsedLat, parsedLng)}
          src={widgetSrc(parsedLat, parsedLng)}
          title={hasPoint ? "Tanlangan yetkazish nuqtasi" : "Toshkent xaritasi"}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-56 w-full border-0 sm:h-64"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={locate}
          disabled={disabled || locating}
          className="inline-flex items-center gap-2 border border-border-strong bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Crosshair className="size-4" />
          )}
          Joylashuvimni aniqlash
        </button>
        <a
          href={browseUrl(parsedLat, parsedLng)}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="size-4" /> Kattaroq xaritada ochish
        </a>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField
          label={`Kenglik (lat, ${UZ_LAT.min}–${UZ_LAT.max})`}
          value={lat}
          onChange={(value) => {
            setGeoError(null);
            onChange({ lat: value, lng });
          }}
          inputMode="decimal"
          placeholder="41.311081"
          disabled={disabled}
        />
        <TextField
          label={`Uzunlik (lng, ${UZ_LNG.min}–${UZ_LNG.max})`}
          value={lng}
          onChange={(value) => {
            setGeoError(null);
            onChange({ lat, lng: value });
          }}
          inputMode="decimal"
          placeholder="69.240562"
          disabled={disabled}
        />
      </div>

      {hasPoint && (
        <p
          className={cn(
            "mt-3 inline-flex items-center gap-2 text-xs font-semibold",
            plausible ? "text-success" : "text-destructive",
          )}
        >
          <MapPin className="size-3.5" />
          {plausible
            ? `Nuqta tanlandi: ${formatCoordinate(parsedLat)}, ${formatCoordinate(parsedLng)}`
            : "Nuqta O'zbekiston hududidan tashqarida — kenglik va uzunlik almashib ketmaganini tekshiring."}
        </p>
      )}

      {(error ?? geoError) && (
        <p role="alert" className="mt-3 text-xs font-semibold text-destructive">
          {error ?? geoError}
        </p>
      )}
    </div>
  );
}
