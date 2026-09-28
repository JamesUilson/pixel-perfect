/**
 * One shop in "Yaqiningizdagi do'konlar".
 *
 * The card the home page already drew, with two things added: how far away the
 * shop is when the visitor has shared a point, and the map link the server
 * built for it. The whole upper block is the link to the shop and the map link
 * sits below it as a sibling — an anchor inside an anchor is invalid markup and
 * the browser's recovery from it is not something to design around.
 */
import { Link } from "@tanstack/react-router";
import { ExternalLink, MapPin, Star } from "lucide-react";

import { formatDistance } from "./distance";
import type { NearbyStore } from "@/lib/query/discovery";

/** "Cobalt House" -> "CO", the avatar fallback the section has always drawn. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase();
  return `${(words[0] ?? "").charAt(0)}${(words[1] ?? "").charAt(0)}`.toUpperCase();
}

export function NearbyStoreCard({ row }: { row: NearbyStore }) {
  const { store } = row;
  const distance = formatDistance(row.distance_km);
  const place = [store.district, store.region].filter(Boolean).join(", ");
  const logo = store.logo_url ?? store.icon_url;

  return (
    <div className="flex flex-col bg-background p-5 sm:p-6">
      <Link
        to="/feed/creators/$handle"
        // The slug, not the handle: the profile endpoint takes either, and a
        // store that has not chosen a handle still has a slug.
        params={{ handle: store.slug }}
        className="group flex flex-1 flex-col"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-xs font-bold text-background">
            {logo ? (
              <img src={logo} alt="" className="size-full object-cover" />
            ) : (
              initials(store.store_name)
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
            <Star className="size-4 fill-primary text-primary" aria-hidden />
            {Number(store.rating_avg).toFixed(1)}
          </span>
        </div>

        <h3 className="type-h3 mt-6 transition-colors group-hover:text-primary sm:mt-8">
          {store.store_name}
        </h3>

        <p className="type-caption mt-2 flex items-start gap-1">
          <MapPin className="mt-px size-4 shrink-0" aria-hidden />
          <span className="min-w-0">
            {/* The distance leads when there is one: it is the only reason this
                list is ordered the way it is. */}
            {distance && <span className="font-semibold text-foreground">{distance}</span>}
            {distance && place && <span aria-hidden> · </span>}
            {place}
          </span>
        </p>

        {row.address && <p className="type-caption mt-1 line-clamp-2">{row.address}</p>}

        <p className="type-caption mt-1">{store.rating_count} ta sharh</p>
      </Link>

      {row.pin_url && (
        <a
          href={row.pin_url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 border-t border-border pt-4 text-xs font-semibold text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Xaritada ochish
          <span className="sr-only"> — {store.store_name}</span>
        </a>
      )}
    </div>
  );
}
