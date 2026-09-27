/**
 * Everything the public feed asks of the API.
 *
 * Three things are worth knowing before reading on.
 *
 * **The shapes are written out here rather than pulled from `api/types.ts`.**
 * The generated `schema.d.ts` predates the feed endpoints, so aliasing it would
 * alias nothing. These types mirror `app/modules/feed/schemas.py` and
 * `app/modules/videos/schemas.py` field for field; a `Decimal` on the server
 * arrives as a string, which is why every price is typed `string | null`.
 *
 * **Interactions are optimistic and then reconciled.** A tap paints the new
 * state immediately, the server's own `liked` / `like_count` overwrites it on
 * success, and a failure puts the previous state back where the person can see
 * it. The counters the API returns are authoritative — the backend guarantees
 * they match a recount from the event tables — so the response always wins over
 * the guess.
 *
 * **One video lives in several caches at once.** It can be in the scroller, in
 * the detail screen and in a creator's grid simultaneously, so every patch
 * walks all of them; that is what `qk.feed`'s shared "feed" prefix is for.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { safeApi } from "@/lib/api/client";
import { qk } from "./keys";

/* ============================================================================
 * Shapes
 * ========================================================================== */

export type CursorPage<T> = { items: T[]; next_cursor: string | null; has_more: boolean };
export type OffsetPage<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
};

export type AuthorBrief = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type FeedSellerBrief = {
  id: string;
  slug: string;
  store_name: string;
  icon_url: string | null;
  logo_url: string | null;
  region: string;
  district: string;
  verification_level: string;
  rating_avg: string;
  rating_count: number;
};

export type FeedProduct = {
  product_id: string;
  offer_id: string | null;
  slug: string;
  name: string;
  oem_number: string | null;
  image_url: string | null;
  price: string | null;
  old_price: string | null;
  currency: string;
  in_stock: boolean;
  position_x: string | null;
  position_y: string | null;
  start_second: number | null;
};

export type VideoCounters = {
  view_count: number;
  like_count: number;
  comment_count: number;
  save_count: number;
  share_count: number;
};

export type FeedVideo = {
  id: string;
  caption: string | null;
  hashtags: string[];
  region: string | null;
  thumbnail_url: string | null;
  hls_url: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  published_at: string | null;
  /**
   * Not in `FeedVideoOut` yet — the feed serialiser only carries `hls_url`,
   * which is null until a transcoder exists. Declared optional so the moment
   * the field is added the player starts using it with no change here.
   */
  playback_url?: string | null;
};

export type FeedItem = {
  video: FeedVideo;
  counters: VideoCounters;
  author: AuthorBrief;
  seller: FeedSellerBrief | null;
  products: FeedProduct[];
  liked: boolean;
  saved: boolean;
  following: boolean;
};

export type FeedComment = {
  id: string;
  video_id: string;
  parent_id: string | null;
  author: AuthorBrief;
  body: string;
  is_deleted: boolean;
  like_count: number;
  liked: boolean;
  created_at: string;
  reply_count: number;
  /** The first two, inlined by the server. The rest come from the thread call. */
  replies?: FeedComment[];
};

export type TaggedProduct = {
  product_id: string;
  offer_id: string | null;
  name: string;
  slug: string;
  image_url: string | null;
  price: string | null;
  currency: string;
  in_stock: boolean;
  position_x: string | null;
  position_y: string | null;
  start_second: number | null;
  sort_order: number;
};

export type VideoCard = {
  id: string;
  thumbnail_url: string | null;
  playback_url: string | null;
  caption: string | null;
  duration_seconds: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  published_at: string | null;
  status?: string | null;
  moderation_status?: string | null;
  is_public?: boolean | null;
};

export type CreatorTab = "videos" | "products" | "saved";

export type VideoGrid = {
  tab: CreatorTab;
  items: VideoCard[];
  products: TaggedProduct[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
};

export type CreatorFact = { key: string; text: string };

export type CreatorProfile = {
  seller_id: string;
  handle: string;
  store_name: string;
  slug: string;
  avatar_url: string | null;
  banner_url: string | null;
  description_uz: string | null;
  is_verified: boolean;
  is_trusted: boolean;
  verification_level: string;
  region: string;
  district: string;
  video_count: number;
  follower_count: number;
  following_count: number;
  /** Whether the person looking already follows, so the button opens right. */
  is_following: boolean;
  /** The owner gets the owner's affordances and the visitor-view switch. */
  is_owner: boolean;
  facts: CreatorFact[];
  /** Bullets the design asks for that this data model cannot answer. Omitted, never invented. */
  unavailable_facts: string[];
  videos: VideoGrid;
};

export type ShareChannel = "TELEGRAM" | "WHATSAPP" | "INSTAGRAM" | "LINK" | "QR";

/**
 * The moderation taxonomy, in the wording the API ships with.
 *
 * Mirrors `REPORT_REASONS` in `app/modules/feed/schemas.py`. There is no
 * endpoint that serves it, so it is duplicated rather than guessed — and the
 * codes, not the labels, are what travels.
 */
export const REPORT_REASONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: "SPAM", label: "Spam yoki reklama" },
  { code: "MISLEADING", label: "Chalg'ituvchi ma'lumot" },
  { code: "COUNTERFEIT", label: "Qalbaki mahsulot" },
  { code: "OFFENSIVE", label: "Haqoratli yoki nomaqbul kontent" },
  { code: "VIOLENCE", label: "Zo'ravonlik" },
  { code: "COPYRIGHT", label: "Mualliflik huquqi buzilgan" },
  { code: "WRONG_PRODUCT", label: "Videoga aloqasi yo'q mahsulot belgilangan" },
  { code: "OTHER", label: "Boshqa sabab" },
];

type LikeOut = { liked: boolean; like_count: number };
type SaveOut = { saved: boolean; save_count: number };
type ShareOut = { share_count: number };
type FollowOut = { following: boolean; follower_count: number };
type ViewOut = { recorded: boolean; view_count: number };
type ReportOut = { reported: boolean; report_count: number };

/* ============================================================================
 * Cache surgery
 * ========================================================================== */

type FeedPages = { pages: CursorPage<FeedItem>[]; pageParams: unknown[] };

function isFeedPages(value: unknown): value is FeedPages {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { pages?: unknown }).pages)
  );
}

function isFeedItem(value: unknown): value is FeedItem {
  return typeof value === "object" && value !== null && "video" in value && "counters" in value;
}

/**
 * Apply `patch` to one video wherever it is cached.
 *
 * `setQueriesData` over the "feed" prefix also visits the comment and creator
 * caches, which is why the shape is checked rather than assumed: anything that
 * is not a page of feed items or a lone feed item is handed back untouched.
 */
function patchVideo(
  queryClient: QueryClient,
  videoId: string,
  patch: (item: FeedItem) => FeedItem,
) {
  queryClient.setQueriesData({ queryKey: ["feed"] }, (data: unknown) => {
    if (isFeedItem(data)) return data.video.id === videoId ? patch(data) : data;
    if (!isFeedPages(data)) return data;
    let touched = false;
    const pages = data.pages.map((page) => {
      if (!page.items.some((item) => item.video.id === videoId)) return page;
      touched = true;
      return {
        ...page,
        items: page.items.map((item) => (item.video.id === videoId ? patch(item) : item)),
      };
    });
    return touched ? { ...data, pages } : data;
  });
}

/** The same, for every video of one store — following is a property of the store. */
function patchSeller(
  queryClient: QueryClient,
  sellerId: string,
  patch: (item: FeedItem) => FeedItem,
) {
  queryClient.setQueriesData({ queryKey: ["feed"] }, (data: unknown) => {
    if (isFeedItem(data)) return data.seller?.id === sellerId ? patch(data) : data;
    if (!isFeedPages(data)) return data;
    let touched = false;
    const pages = data.pages.map((page) => {
      if (!page.items.some((item) => item.seller?.id === sellerId)) return page;
      touched = true;
      return {
        ...page,
        items: page.items.map((item) => (item.seller?.id === sellerId ? patch(item) : item)),
      };
    });
    return touched ? { ...data, pages } : data;
  });
}

function dropVideo(queryClient: QueryClient, videoId: string) {
  queryClient.setQueriesData({ queryKey: ["feed"] }, (data: unknown) => {
    if (!isFeedPages(data)) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.filter((item) => item.video.id !== videoId),
      })),
    };
  });
  queryClient.removeQueries({ queryKey: qk.feedVideo(videoId) });
}

type Snapshot = Array<[QueryKey, unknown]>;

function snapshotFeed(queryClient: QueryClient): Snapshot {
  return queryClient.getQueriesData({ queryKey: ["feed"] });
}

/** Put every entry back exactly as it was — what makes a failure visibly revert. */
function restoreFeed(queryClient: QueryClient, snapshot: Snapshot) {
  for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
}

function bumpCounter(item: FeedItem, key: keyof VideoCounters, delta: number): FeedItem {
  return {
    ...item,
    counters: { ...item.counters, [key]: Math.max(0, item.counters[key] + delta) },
  };
}

/* ============================================================================
 * The feed itself
 * ========================================================================== */

export type FeedFilters = {
  following?: boolean | undefined;
  seller?: string | undefined;
  limit?: number | undefined;
};

const DEFAULT_PAGE_SIZE = 8;

export function useFeed(filters: FeedFilters = {}) {
  const { following = false, seller, limit = DEFAULT_PAGE_SIZE } = filters;
  return useInfiniteQuery({
    queryKey: qk.feed({ following, seller: seller ?? null, limit }),
    queryFn: ({ pageParam, signal }) =>
      safeApi<CursorPage<FeedItem>>("/feed", {
        query: {
          limit,
          cursor: pageParam ?? undefined,
          following: following ? true : undefined,
          seller,
        },
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.has_more ? last.next_cursor : null),
    // A clip that has been watched does not need re-reading on every focus, and
    // re-ordering the feed under someone mid-scroll is worse than slightly old
    // counters.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** The clip the scroller already loaded, so tapping into it does not blank. */
function findCached(queryClient: QueryClient, videoId: string): FeedItem | null {
  for (const [, data] of queryClient.getQueriesData({ queryKey: ["feed"] })) {
    if (isFeedItem(data) && data.video.id === videoId) return data;
    if (!isFeedPages(data)) continue;
    for (const page of data.pages) {
      const hit = page.items.find((item) => item.video.id === videoId);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * One clip by id.
 *
 * Straight to `GET /videos/{id}`, which applies the same visibility rule the
 * feed does. It deliberately does not fall back to searching feed pages: a
 * shared link points at a specific clip, and a clip the ranking does not
 * surface — an old one, or one this viewer muted — must still open for them.
 */
export function useFeedVideo(videoId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.feedVideo(videoId),
    queryFn: ({ signal }) => safeApi<FeedItem>(`/videos/${videoId}`, { signal }),
    // Tapping through from the scroller should not blank the screen while the
    // request the cache could have answered is in flight.
    initialData: () => findCached(queryClient, videoId),
    initialDataUpdatedAt: () => (findCached(queryClient, videoId) ? Date.now() : 0),
    staleTime: 60_000,
    retry: false,
  });
}

/* ============================================================================
 * Views
 * ========================================================================== */

export type WatchReport = { watchMs: number; completed: boolean; skipped: boolean };

/**
 * Record that a clip was watched.
 *
 * `watch_ms` is measured by the player, never assumed. The backend dedupes a
 * viewer within its own window, so scrolling back to a clip is not a second
 * view and the mutation does not have to guard against it.
 */
export function useRecordView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId, watchMs, completed, skipped }: WatchReport & { videoId: string }) =>
      safeApi<ViewOut>(`/videos/${videoId}/view`, {
        method: "POST",
        body: { watch_ms: Math.max(0, Math.round(watchMs)), completed, skipped },
      }),
    onSuccess: (data, { videoId }) => {
      if (!data.recorded) return;
      patchVideo(queryClient, videoId, (item) => ({
        ...item,
        counters: { ...item.counters, view_count: data.view_count },
      }));
    },
    // A view that did not register is not worth telling anybody about.
    onError: () => {},
  });
}

/* ============================================================================
 * Likes, saves, follows, shares
 * ========================================================================== */

export function useToggleVideoLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId, liked }: { videoId: string; liked: boolean }) =>
      safeApi<LikeOut>(`/videos/${videoId}/like`, { method: liked ? "DELETE" : "POST" }),
    onMutate: async ({ videoId, liked }) => {
      await queryClient.cancelQueries({ queryKey: ["feed"] });
      const snapshot = snapshotFeed(queryClient);
      patchVideo(queryClient, videoId, (item) =>
        bumpCounter({ ...item, liked: !liked }, "like_count", liked ? -1 : 1),
      );
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context) restoreFeed(queryClient, context.snapshot);
    },
    onSuccess: (data, { videoId }) => {
      patchVideo(queryClient, videoId, (item) => ({
        ...item,
        liked: data.liked,
        counters: { ...item.counters, like_count: data.like_count },
      }));
    },
  });
}

export function useToggleVideoSave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId, saved }: { videoId: string; saved: boolean }) =>
      safeApi<SaveOut>(`/videos/${videoId}/save`, { method: saved ? "DELETE" : "POST" }),
    onMutate: async ({ videoId, saved }) => {
      await queryClient.cancelQueries({ queryKey: ["feed"] });
      const snapshot = snapshotFeed(queryClient);
      patchVideo(queryClient, videoId, (item) =>
        bumpCounter({ ...item, saved: !saved }, "save_count", saved ? -1 : 1),
      );
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context) restoreFeed(queryClient, context.snapshot);
    },
    onSuccess: (data, { videoId }) => {
      patchVideo(queryClient, videoId, (item) => ({
        ...item,
        saved: data.saved,
        counters: { ...item.counters, save_count: data.save_count },
      }));
    },
  });
}

export function useToggleFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sellerId, following }: { sellerId: string; following: boolean }) =>
      safeApi<FollowOut>("/feed/follow", {
        method: following ? "DELETE" : "POST",
        body: { seller_id: sellerId },
      }),
    onMutate: async ({ sellerId, following }) => {
      await queryClient.cancelQueries({ queryKey: ["feed"] });
      const snapshot = snapshotFeed(queryClient);
      patchSeller(queryClient, sellerId, (item) => ({ ...item, following: !following }));
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context) restoreFeed(queryClient, context.snapshot);
    },
    onSuccess: (data, { sellerId }) => {
      patchSeller(queryClient, sellerId, (item) => ({ ...item, following: data.following }));
      // The creator profile carries its own follower count, and it has just moved.
      void queryClient.invalidateQueries({ queryKey: ["feed", "creator"] });
    },
  });
}

/**
 * Record a share, and on which channel.
 *
 * Every route out of the share sheet posts this, including the copied link and
 * the QR code, because "where do my clips travel" is the one thing a store can
 * act on and a half-counted number answers it wrongly.
 */
export function useShareVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId, channel }: { videoId: string; channel: ShareChannel }) =>
      safeApi<ShareOut>(`/videos/${videoId}/share`, { method: "POST", body: { channel } }),
    onMutate: async ({ videoId }) => {
      const snapshot = snapshotFeed(queryClient);
      patchVideo(queryClient, videoId, (item) => bumpCounter(item, "share_count", 1));
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context) restoreFeed(queryClient, context.snapshot);
    },
    onSuccess: (data, { videoId }) => {
      patchVideo(queryClient, videoId, (item) => ({
        ...item,
        counters: { ...item.counters, share_count: data.share_count },
      }));
    },
  });
}

/* ============================================================================
 * "Qiziq emas" and reports
 * ========================================================================== */

export function useNotInterested() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId }: { videoId: string }) =>
      safeApi<{ recorded: boolean }>(`/videos/${videoId}/not-interested`, { method: "POST" }),
    onSuccess: (_data, { videoId }) => {
      // The server drops it from this viewer's feed outright, so the cache
      // should stop showing it before the next page arrives.
      dropVideo(queryClient, videoId);
    },
  });
}

export function useReportVideo() {
  return useMutation({
    mutationFn: ({
      videoId,
      reasonCode,
      detail,
    }: {
      videoId: string;
      reasonCode: string;
      detail?: string | undefined;
    }) =>
      safeApi<ReportOut>(`/videos/${videoId}/report`, {
        method: "POST",
        body: { reason_code: reasonCode, detail: detail?.trim() ? detail.trim() : null },
      }),
  });
}

/* ============================================================================
 * Comments
 * ========================================================================== */

export type CommentSort = "new" | "top";

const COMMENT_PAGE_SIZE = 20;

export function useComments(videoId: string, sort: CommentSort, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.feedComments(videoId, sort),
    queryFn: ({ pageParam, signal }) =>
      safeApi<OffsetPage<FeedComment>>(`/videos/${videoId}/comments`, {
        query: { page: pageParam, size: COMMENT_PAGE_SIZE, sort },
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : null),
    enabled: enabled && videoId.length > 0,
    staleTime: 30_000,
  });
}

/**
 * The rest of one thread.
 *
 * The list call inlines the first two replies of every top-level comment; this
 * is what "Yana N ta javobni ko'rish" pages through, oldest first, which is why
 * the first two come back again and the caller drops the overlap.
 */
export function useReplies(commentId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: qk.feedReplies(commentId),
    queryFn: ({ pageParam, signal }) =>
      safeApi<OffsetPage<FeedComment>>(`/comments/${commentId}/replies`, {
        query: { page: pageParam, size: COMMENT_PAGE_SIZE },
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : null),
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateComment(videoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId?: string | undefined }) =>
      safeApi<FeedComment>(`/videos/${videoId}/comments`, {
        method: "POST",
        body: { body, parent_id: parentId ?? null },
      }),
    onSuccess: (_comment, { parentId }) => {
      patchVideo(queryClient, videoId, (item) => bumpCounter(item, "comment_count", 1));
      void queryClient.invalidateQueries({ queryKey: ["feed", "comments", videoId] });
      if (parentId) void queryClient.invalidateQueries({ queryKey: qk.feedReplies(parentId) });
    },
  });
}

export function useDeleteComment(videoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId }: { commentId: string; parentId?: string | undefined }) =>
      safeApi<void>(`/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: (_result, { parentId }) => {
      patchVideo(queryClient, videoId, (item) => bumpCounter(item, "comment_count", -1));
      void queryClient.invalidateQueries({ queryKey: ["feed", "comments", videoId] });
      if (parentId) void queryClient.invalidateQueries({ queryKey: qk.feedReplies(parentId) });
    },
  });
}

/** Patch one comment wherever it sits: a page of the list, an inlined reply, or a thread. */
function patchComment(
  queryClient: QueryClient,
  commentId: string,
  patch: (comment: FeedComment) => FeedComment,
) {
  const applyTo = (comment: FeedComment): FeedComment => {
    const replies = comment.replies?.map(applyTo);
    const next = comment.id === commentId ? patch(comment) : comment;
    return replies ? { ...next, replies } : next;
  };
  queryClient.setQueriesData({ queryKey: ["feed"] }, (data: unknown) => {
    if (typeof data !== "object" || data === null) return data;
    const pages = (data as { pages?: unknown }).pages;
    if (!Array.isArray(pages)) return data;
    const isCommentPage = pages.every(
      (page) =>
        typeof page === "object" &&
        page !== null &&
        Array.isArray((page as { items?: unknown }).items) &&
        (page as { items: unknown[] }).items.every(
          (entry) => typeof entry === "object" && entry !== null && "body" in entry,
        ),
    );
    if (!isCommentPage) return data;
    return {
      ...(data as object),
      pages: (pages as OffsetPage<FeedComment>[]).map((page) => ({
        ...page,
        items: page.items.map(applyTo),
      })),
    };
  });
}

export function useToggleCommentLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, liked }: { commentId: string; liked: boolean }) =>
      safeApi<LikeOut>(`/comments/${commentId}/like`, { method: liked ? "DELETE" : "POST" }),
    onMutate: async ({ commentId, liked }) => {
      await queryClient.cancelQueries({ queryKey: ["feed", "comments"] });
      const snapshot = snapshotFeed(queryClient);
      patchComment(queryClient, commentId, (comment) => ({
        ...comment,
        liked: !liked,
        like_count: Math.max(0, comment.like_count + (liked ? -1 : 1)),
      }));
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context) restoreFeed(queryClient, context.snapshot);
    },
    onSuccess: (data, { commentId }) => {
      patchComment(queryClient, commentId, (comment) => ({
        ...comment,
        liked: data.liked,
        like_count: data.like_count,
      }));
    },
  });
}

/* ============================================================================
 * The creator profile
 * ========================================================================== */

export function useCreator(handle: string) {
  return useQuery({
    queryKey: qk.creator(handle),
    queryFn: ({ signal }) =>
      safeApi<CreatorProfile>(`/feed/creators/${encodeURIComponent(handle)}`, {
        query: { per_page: 12 },
        signal,
      }),
    enabled: handle.length > 0,
    staleTime: 60_000,
  });
}

const GRID_PAGE_SIZE = 12;

export function useCreatorGrid(handle: string, tab: CreatorTab, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.creatorGrid(handle, tab),
    queryFn: ({ pageParam, signal }) =>
      safeApi<VideoGrid>(`/feed/creators/${encodeURIComponent(handle)}/videos`, {
        query: { tab, page: pageParam, per_page: GRID_PAGE_SIZE },
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : null),
    enabled: enabled && handle.length > 0,
    staleTime: 60_000,
    // The saved tab answers 403 to anyone but the owner; retrying that is noise.
    retry: false,
  });
}
