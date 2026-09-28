/**
 * "Yaqiningizdagi do'konlar".
 *
 * The section is built so that the location prompt is an offer and never a
 * toll. It renders a full list before anything is asked — the best-rated shops,
 * which is what the API returns when it is given no point — and only then
 * offers one control that says what sharing a location would buy. A visitor who
 * ignores it, refuses it, or is on a browser that cannot answer sees the same
 * list they started with, plus a line saying why there are no distances.
 *
 * Which list is on screen is read from the server's `basis` field, never
 * guessed from whether a distance happens to be filled in: a rating row also
 * carries a null distance, so inferring it would head the rating list
 * "Yaqiningizda" the moment a shop had no coordinates.
 */
import { useState } from "react";
import { Crosshair, Loader2, Map as MapIcon, Star, X } from "lucide-react";

import { SectionHead } from "@/components/avtoqism/Page";
import { ErrorState } from "@/components/avtoqism/States";
import { NearbyStoreCard } from "./NearbyStoreCard";
import { StoreMapEmbed } from "./StoreMapEmbed";
import { useNearbyLocation } from "./useNearbyLocation";
import { useNearbySellers, useSellerMap } from "@/lib/query/discovery";

/** Six cards fill two rows at every column count the grid uses. */
const LIMIT = 6;

export function NearbyStores() {
  const location = useNearbyLocation();
  const [mapOpen, setMapOpen] = useState(false);

  const nearby = useNearbySellers(location.point, { limit: LIMIT });
  const map = useSellerMap(location.point, { enabled: mapOpen });

  // While the distance list loads, `keepPreviousData` still holds the rating
  // list, so this reads the basis off whatever is actually on screen.
  const basis = nearby.data?.basis ?? null;
  const byDistance = basis === "distance";

  return (
    <section className="border-t border-border py-14">
      <SectionHead
        eyebrow={byDistance ? "Yaqiningizda" : "Do'konlar"}
        title={byDistance ? "Yaqiningizdagi do'konlar" : "Eng yaxshi baholangan do'konlar"}
        subtitle={
          byDistance
            ? "Joylashuvingizdan 10 km radiusda, eng yaqini birinchi"
            : "Toshkentdagi eng yuqori baholangan sotuvchilar"
        }
        action={
          <button
            type="button"
            onClick={() => setMapOpen((open) => !open)}
            aria-expanded={mapOpen}
            className="inline-flex shrink-0 items-center gap-2 border border-border-strong bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <MapIcon className="size-4" aria-hidden />
            <span className="hidden sm:inline">
              {mapOpen ? "Xaritani yopish" : "Xaritada ko'rish"}
            </span>
            <span className="sm:hidden">{mapOpen ? "Yopish" : "Xarita"}</span>
          </button>
        }
      />

      <LocationBar location={location} />

      {mapOpen && (
        <div className="mb-6">
          {map.isPending ? (
            <div className="h-64 animate-pulse border border-border bg-muted sm:h-80 lg:h-96" />
          ) : map.isError ? (
            <ErrorState error={map.error} onRetry={() => void map.refetch()} compact />
          ) : (
            <StoreMapEmbed map={map.data} />
          )}
        </div>
      )}

      {nearby.isPending ? (
        <div className="grid gap-px bg-border sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-52 animate-pulse bg-card" />
          ))}
        </div>
      ) : nearby.isError ? (
        <div className="space-y-4">
          <ErrorState error={nearby.error} onRetry={() => void nearby.refetch()} compact />
          {/* A point the API refuses — outside the country, say — must not cost
              the visitor the section. Dropping it puts the rating list back. */}
          {location.point && (
            <button
              type="button"
              onClick={location.clear}
              className="inline-flex items-center gap-2 border border-border-strong bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <Star className="size-4" aria-hidden />
              Reyting bo'yicha ko'rsatish
            </button>
          )}
        </div>
      ) : nearby.data.items.length === 0 ? (
        <p className="type-caption border border-dashed border-border px-5 py-10 text-center">
          {byDistance
            ? "Bu radiusda do'kon topilmadi. Xaritadan kengroq hududni ko'rib chiqing."
            : "Hozircha sotuvchilar ro'yxati bo'sh."}
        </p>
      ) : (
        <div className="grid gap-px bg-border sm:grid-cols-2 md:grid-cols-3">
          {nearby.data.items.map((row) => (
            <NearbyStoreCard key={row.store.id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The one control that asks, and the one line that explains the answer.
 *
 * Deliberately a separate block above the list rather than an overlay or an
 * empty state: the list is already there and already useful, and this is an
 * offer to improve it.
 */
function LocationBar({ location }: { location: ReturnType<typeof useNearbyLocation> }) {
  const { status, message, ask, clear } = location;

  if (status === "granted") {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border border-border bg-card px-4 py-3">
        <p className="type-caption min-w-0 flex-1">
          Ro'yxat joylashuvingiz bo'yicha saralandi. Joylashuv faqat shu brauzer sessiyasida
          saqlanadi.
        </p>
        <button
          type="button"
          onClick={clear}
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
          Joylashuvni o'chirish
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 border border-border bg-card px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <p className="type-caption min-w-0 sm:flex-1">
          Joylashuvingizni ulashsangiz, har bir do'kongacha bo'lgan masofani ko'rsatamiz va
          ro'yxatni eng yaqinidan boshlab saralaymiz. Koordinatalar faqat shu so'rov uchun
          ishlatiladi.
        </p>

        {/* A denial is enforced by the browser: tapping again does nothing, so
            the button goes and the message says where to change it instead. */}
        {status !== "denied" && (
          <button
            type="button"
            onClick={ask}
            disabled={status === "asking"}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
          >
            {status === "asking" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Crosshair className="size-4" aria-hidden />
            )}
            {status === "asking"
              ? "Aniqlanmoqda…"
              : status === "unavailable"
                ? "Qayta urinish"
                : "Yaqinimdagilarni ko'rsatish"}
          </button>
        )}
      </div>

      <p aria-live="polite" className={message ? "mt-3 text-sm text-muted-foreground" : "sr-only"}>
        {message ?? (status === "asking" ? "Joylashuv aniqlanmoqda" : "")}
      </p>
    </div>
  );
}
