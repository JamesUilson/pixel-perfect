/**
 * Where the parcel goes, and the one tap that starts the route.
 *
 * Both links come from the server — `navigator_url` is the `yandexnavi://` deep
 * link, `maps_url` the browser fallback — because the coordinates are exact
 * Decimals there and re-encoding them here is how a driver ends up one street
 * over. The deep link is only offered to a finger: on a laptop it can only
 * fail, and the fallback is what works everywhere.
 */
import { ExternalLink, MapPin, Navigation, UserRound } from "lucide-react";

import { formatPhone } from "@/lib/format";
import type { DeliveryAddress } from "@/lib/query/commerce";
import { useCoarsePointer } from "./useCoarsePointer";

export function DeliveryAddressCard({
  address,
  line,
  recipientName,
  recipientPhone,
  contactIsSelf = true,
  title = "Yetkazish manzili",
}: {
  address: DeliveryAddress | null | undefined;
  /** Used when the server sent no formatted block — an older order. */
  line: string;
  recipientName: string;
  recipientPhone: string;
  contactIsSelf?: boolean | undefined;
  title?: string | undefined;
}) {
  const touch = useCoarsePointer();
  const navigatorUrl = address?.navigator_url ?? null;
  const mapsUrl = address?.maps_url ?? null;
  const text = address?.line || line;

  return (
    <div className="border border-border bg-card p-6">
      <h2 className="type-h3">{title}</h2>

      <p className="mt-4 text-sm font-semibold">{recipientName}</p>
      <p className="type-caption">{formatPhone(recipientPhone) || recipientPhone}</p>
      {!contactIsSelf && (
        <p className="type-caption mt-1 inline-flex items-center gap-1.5">
          <UserRound className="size-3.5" /> Buyurtmani boshqa shaxs qabul qiladi
        </p>
      )}

      <p className="type-caption mt-3 flex items-start gap-2">
        <MapPin className="mt-0.5 size-3.5 shrink-0" />
        <span>{text || "Manzil ko'rsatilmagan"}</span>
      </p>

      {mapsUrl ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {touch && navigatorUrl && (
            <a
              href={navigatorUrl}
              className="inline-flex items-center gap-2 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Navigation className="size-4" /> Navigatorda ochish
            </a>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 border border-border-strong bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <ExternalLink className="size-4" /> Xaritada ochish
          </a>
        </div>
      ) : (
        <p className="type-caption mt-4">
          Bu manzil uchun xarita nuqtasi tanlanmagan, shuning uchun marshrut havolasi yo'q.
        </p>
      )}
    </div>
  );
}
