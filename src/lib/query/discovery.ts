/**
 * The discovery module: what one person follows, what they kept, and — in the
 * block appended below by the map work — which stores are near them.
 *
 * The shapes mirror `app/modules/discovery/schemas.py` field for field. A
 * `Decimal` on the server arrives as a string, which is why a rating is typed
 * `string` and never `number`.
 *
 * Two things about the two lists here.
 *
 * **They are the person's own, and only ever their own.** Every path is
 * `/me/...`; the server takes the caller as the subject and there is no
 * variant that names a user. So the cache keys sit under `qk` "me" with the
 * cart and the wallet, and sign-out clears them with everything else.
 *
 * **Removing a row has to remove it here.** Unfollowing and unsaving are the
 * feed's own mutations (`useToggleFollow`, `useToggleVideoSave`), and those
 * patch the feed's caches — they know nothing about these pages. The two
 * `forget*` helpers below are what the account screen calls so a row leaves
 * the list it was removed from, rather than sitting there until a refetch.
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { safeApi } from "@/lib/api/client";
import type { AuthorBrief, FeedSellerBrief, OffsetPage, VideoCard } from "./feed";
import { qk } from "./keys";
import { useIsAuthenticated } from "./session";

/* ============================================================================
 * Shapes
 * ========================================================================== */

/**
 * The feed's store brief plus `handle`.
 *
 * `StoreBriefOut` subclasses `SellerBriefOut` on the server for exactly this
 * reason: a store under a video and a store in a subscription row are one
 * object, not two that have to be reconciled. The handle can be null — a store
 * that has never been opened as a creator profile has not been allocated one —
 * and the slug is accepted wherever a handle is, so `handle ?? slug` always
 * addresses the right store.
 */
export type StoreBrief = FeedSellerBrief & { handle: string | null };

/** One row of "Obuna bo'lgan do'konlar". Exactly one of the two is filled. */
export type FollowedChannel = {
  kind: "store" | "person";
  store: StoreBrief | null;
  person: AuthorBrief | null;
  /** Public clips only: what a visitor tapping through would actually find. */
  video_count: number;
  follower_count: number;
  followed_at: string;
};

/** A kept clip. `store` is null for one posted by a person rather than a shop. */
export type SavedVideo = {
  video: VideoCard;
  store: StoreBrief | null;
  saved_at: string;
};

/** Ten rows is a screenful on a phone without a scroll that never ends. */
export const FOLLOWING_PAGE_SIZE = 10;
/** Twelve tiles: four rows of three, the same grid the creator page draws. */
export const SAVED_PAGE_SIZE = 12;

/* ============================================================================
 * The two lists
 * ========================================================================== */

export function useFollowing(page: number) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.following(page),
    queryFn: ({ signal }) =>
      safeApi<OffsetPage<FollowedChannel>>("/me/following", {
        query: { page, size: FOLLOWING_PAGE_SIZE },
        signal,
      }),
    enabled: signedIn,
    // Paging should move the rows, not blank the section and move it back.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useSavedVideos(page: number) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.savedVideos(page),
    queryFn: ({ signal }) =>
      safeApi<OffsetPage<SavedVideo>>("/me/saved-videos", {
        query: { page, size: SAVED_PAGE_SIZE },
        signal,
      }),
    enabled: signedIn,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/* ============================================================================
 * Keeping the lists honest when a row is removed
 * ========================================================================== */

function isOffsetPage(data: unknown): data is OffsetPage<unknown> {
  return (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as { items?: unknown }).items) &&
    typeof (data as { total?: unknown }).total === "number"
  );
}

/**
 * Drop every row `matches` accepts from every cached page under `prefix`, and
 * take the total down with it.
 *
 * The total matters: it is what the pager prints and what decides whether
 * there is a next page at all, so leaving it at the old value would show
 * "1–10 / 11" over ten rows and a dead "Keyingi" button.
 */
function forget<T>(
  queryClient: QueryClient,
  prefix: readonly unknown[],
  matches: (item: T) => boolean,
) {
  queryClient.setQueriesData({ queryKey: prefix }, (data: unknown) => {
    if (!isOffsetPage(data)) return data;
    const items = (data.items as T[]).filter((item) => !matches(item));
    const removed = data.items.length - items.length;
    if (removed === 0) return data;
    return { ...data, items, total: Math.max(0, data.total - removed) };
  });
}

/** After an unfollow: the store leaves "Obuna bo'lgan do'konlar" at once. */
export function forgetFollowedStore(queryClient: QueryClient, sellerId: string) {
  forget<FollowedChannel>(queryClient, ["me", "following"], (row) => row.store?.id === sellerId);
}

export function forgetFollowedPerson(queryClient: QueryClient, userId: string) {
  forget<FollowedChannel>(queryClient, ["me", "following"], (row) => row.person?.id === userId);
}

/** After an unsave: the tile leaves "Saqlangan videolar" at once. */
export function forgetSavedVideo(queryClient: QueryClient, videoId: string) {
  forget<SavedVideo>(queryClient, ["me", "saved-videos"], (row) => row.video.id === videoId);
}

/**
 * Put a list back the way the server has it.
 *
 * Called when a removal fails — the optimistic drop above has to be undone and
 * this browser has no record of what it removed — and when one succeeds, so
 * the page that was half-emptied refills from the rows behind it.
 */
export function refreshFollowing(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["me", "following"] });
}

export function refreshSavedVideos(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["me", "saved-videos"] });
}

/**
 * Stop following a person.
 *
 * `useToggleFollow` in `feed.ts` covers stores, which is every follow the
 * interface can currently create — but the table holds person-follows too and
 * `/me/following` returns them, so a row that cannot be left would be a row
 * this screen shows and cannot act on. It is deliberately not a toggle: there
 * is nowhere in the app to follow a person from, so there is nothing to undo.
 */
export function useUnfollowPerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      safeApi<{ following: boolean; follower_count: number }>("/feed/follow", {
        method: "DELETE",
        body: { user_id: userId },
      }),
    onSuccess: (_result, { userId }) => forgetFollowedPerson(queryClient, userId),
    onSettled: () => refreshFollowing(queryClient),
  });
}

/* ============================================================================
 * Do'konlar yaqinimda
 *
 * The two public reads behind the home page's nearby section. They answer the
 * same question at two resolutions: `/sellers/nearby` returns rows a person
 * reads, `/sellers/map` returns pins a map draws. Kept apart here because the
 * API keeps them apart, and for the same reason — a pin carries a tenth of a
 * row, and a map is capped rather than paged.
 *
 * Two rules the components depend on:
 *
 *   - **The server says which list it gave.** Sending no point is not an
 *     error; it produces `basis: "rating"` and the best-rated stores instead.
 *     Nothing here infers the basis from whether a distance happens to be
 *     filled in — a rating row also carries a null distance.
 *   - **Map links come from the server.** `pin_url` and `navigator_url` arrive
 *     already built, because Yandex wants `lon,lat` in one and `lat,lon` in
 *     the other and a client that re-derives them eventually sends a driver to
 *     the wrong country.
 *
 * Unlike the two lists above these are open to everyone: a visitor looking for
 * a shop is the caller they exist for, so neither is gated on a session.
 * ========================================================================== */

/** How a list was chosen. The server decides; the UI heads the list from it. */
export type ListBasis = "distance" | "rating";

export type NearbyStore = {
  store: StoreBrief;
  /** Kilometres as a decimal string, or null on the rating fallback. */
  distance_km: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  pin_url: string | null;
  navigator_url: string | null;
};

export type NearbyStores = {
  basis: ListBasis;
  items: NearbyStore[];
};

/** A store trimmed to what a pin needs: enough to draw it and tap it. */
export type StoreMapPin = {
  id: string;
  store_name: string;
  slug: string;
  handle: string | null;
  latitude: string;
  longitude: string;
  rating_avg: string;
  distance_km: string | null;
  pin_url: string | null;
  navigator_url: string | null;
};

export type StoreMap = {
  basis: ListBasis;
  /** Always filled — the caller's point, or central Tashkent. */
  center: { latitude: string; longitude: string };
  pins: StoreMapPin[];
};

/**
 * A point the queries can be keyed by.
 *
 * Latitude and longitude travel together or not at all: the API refuses half a
 * pair with a 422 rather than quietly reading it as "no location", so there is
 * no shape here that can express one without the other.
 */
export type GeoPoint = { latitude: number; longitude: number };

/**
 * Four decimals is about eleven metres.
 *
 * The rounding is the cache key, not the request. A phone re-reports its
 * position every few metres, and keying on the raw fix would make every GPS
 * twitch a cache miss and a fresh request for a list that cannot have changed.
 */
const KEY_PRECISION = 4;

function pointKey(point: GeoPoint | null): string | null {
  if (!point) return null;
  return `${point.latitude.toFixed(KEY_PRECISION)},${point.longitude.toFixed(KEY_PRECISION)}`;
}

/** The pair as the API takes it, or nothing at all. */
function pointQuery(point: GeoPoint | null): { lat: number; lng: number } | undefined {
  if (!point) return undefined;
  return { lat: point.latitude, lng: point.longitude };
}

/** The service's own defaults, repeated so a cache key is never `undefined`. */
const DEFAULT_RADIUS_KM = 10;
const DEFAULT_NEARBY_LIMIT = 6;

export type NearbyOptions = {
  radiusKm?: number | undefined;
  limit?: number | undefined;
  enabled?: boolean | undefined;
};

/**
 * Stores near a point, or the best-rated ones when there is no point.
 *
 * Runs with `point` of null too — that is the list a visitor sees before they
 * are asked for anything, and the one they keep if they say no. Swapping null
 * for a point changes the key, so `keepPreviousData` holds the rating list on
 * screen while the distance list loads rather than blanking the section.
 */
export function useNearbySellers(point: GeoPoint | null, options: NearbyOptions = {}) {
  const radiusKm = options.radiusKm ?? DEFAULT_RADIUS_KM;
  const limit = options.limit ?? DEFAULT_NEARBY_LIMIT;

  return useQuery({
    queryKey: qk.nearbySellers(pointKey(point), radiusKm, limit),
    queryFn: ({ signal }) =>
      safeApi<NearbyStores>("/sellers/nearby", {
        query: { ...pointQuery(point), radius_km: radiusKm, limit },
        signal,
      }),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

/**
 * The same stores as pins.
 *
 * Not fetched until the map is actually opened: the section is useful without
 * it, and a payload of up to two hundred pins is not something to spend on a
 * visitor who never taps "Xaritada".
 */
export function useSellerMap(
  point: GeoPoint | null,
  options: { radiusKm?: number | undefined; enabled?: boolean | undefined } = {},
) {
  const radiusKm = options.radiusKm ?? DEFAULT_RADIUS_KM;

  return useQuery({
    queryKey: qk.sellerMap(pointKey(point), radiusKm),
    queryFn: ({ signal }) =>
      safeApi<StoreMap>("/sellers/map", {
        query: { ...pointQuery(point), radius_km: radiusKm },
        signal,
      }),
    enabled: options.enabled ?? false,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
