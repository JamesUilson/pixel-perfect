/** Small shared pieces of the feed. Pure functions only, so they stay testable. */
import type { FeedSellerBrief, FeedVideo } from "@/lib/query/feed";

/** "Cobalt House" -> "CO". The avatar fallback the design draws. */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase();
  return `${(words[0] ?? "").charAt(0)}${(words[1] ?? "").charAt(0)}`.toUpperCase();
}

/** Seconds -> "0:12" / "1:04:30". Tabular, so the progress row does not jitter. */
export function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(seconds).padStart(2, "0")}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Relative time as the comment sheet writes it: "2 soat oldin". */
export function timeAgoUz(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const delta = Date.now() - then;
  if (delta < MINUTE) return "hozir";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)} daqiqa oldin`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)} soat oldin`;
  if (delta < 30 * DAY) return `${Math.floor(delta / DAY)} kun oldin`;
  if (delta < 365 * DAY) return `${Math.floor(delta / (30 * DAY))} oy oldin`;
  return `${Math.floor(delta / (365 * DAY))} yil oldin`;
}

/**
 * What a player can be given, or null.
 *
 * There is no transcoder yet: `hls_url` is null on every row and the uploaded
 * file is all there is. `playback_url` is where that file will appear once the
 * feed serialiser carries it; until then this returns null for most clips and
 * the caller shows the poster instead of pretending to play something.
 */
export function playableUrl(video: Pick<FeedVideo, "hls_url" | "playback_url">): string | null {
  return video.playback_url ?? video.hls_url ?? null;
}

/**
 * The address a store is reached at.
 *
 * The feed's seller brief carries a slug and not a handle, and the profile
 * endpoint accepts either — deliberately, so a link shared before a store chose
 * a handle keeps working.
 */
export function creatorHandle(seller: Pick<FeedSellerBrief, "slug">): string {
  return seller.slug;
}

export function sellerAvatar(seller: FeedSellerBrief): string | null {
  return seller.logo_url ?? seller.icon_url;
}

/** "Yakkasaroy, Toshkent" — district first, the way the design writes it. */
export function placeOf(seller: Pick<FeedSellerBrief, "district" | "region">): string {
  return [seller.district, seller.region].filter(Boolean).join(", ");
}

/** The absolute link to one clip, for sharing. Falls back to a relative path during SSR. */
export function videoLink(videoId: string): string {
  const path = `/feed/${videoId}`;
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

/**
 * The caption, split for the detail screen: a headline and the rest.
 *
 * The design sets the first line heavier than what follows. A caption without a
 * line break is all headline.
 */
export function splitCaption(caption: string | null): { head: string; rest: string } {
  const text = (caption ?? "").trim();
  const breakAt = text.indexOf("\n");
  if (breakAt === -1) return { head: text, rest: "" };
  return { head: text.slice(0, breakAt).trim(), rest: text.slice(breakAt + 1).trim() };
}
