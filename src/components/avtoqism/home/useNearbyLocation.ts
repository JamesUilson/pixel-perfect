/**
 * The browser's location, asked for once and only when a person asks for it.
 *
 * Nothing here runs on mount. `navigator.geolocation` is touched from a click
 * handler and from nowhere else, because a permission prompt that appears
 * unbidden on page load is the one every browser now penalises and every
 * visitor refuses — and a refusal is remembered by the browser far longer than
 * the visit it was given in.
 *
 * A granted fix is kept for the browsing session, so walking to the catalogue
 * and back does not ask a second time. It is kept in `sessionStorage` rather
 * than `localStorage`: where somebody is standing is true for an afternoon,
 * not for a month, and a stale point would quietly put the wrong distances
 * next to the right shops.
 *
 * Hydration: the stored point is read through `useSyncExternalStore`, whose
 * server snapshot is always "no point". The server and the first client render
 * therefore agree, and a remembered point arrives as a re-render rather than
 * as a mismatch — the same shape `useIsAuthenticated` uses for the same reason.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { GeoPoint } from "@/lib/query/discovery";

const STORAGE_KEY = "avtoqism.nearby-point";

/** How long to wait for a fix before telling the person it did not work. */
const TIMEOUT_MS = 12_000;

/**
 * A minute-old fix is fine.
 *
 * The question is "which shops are near me", answered over a ten-kilometre
 * radius. Insisting on a fresh satellite lock for that spins the radio and
 * makes the button feel broken indoors.
 */
const MAX_AGE_MS = 60_000;

/* --- the session's remembered point ----------------------------------------
 * Module level, so every component that asks sees one answer and one prompt.
 */
let remembered: GeoPoint | null = null;
let consulted = false;
const listeners = new Set<() => void>();

function readStored(): GeoPoint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { latitude, longitude } = parsed as Record<string, unknown>;
    if (typeof latitude !== "number" || typeof longitude !== "number") return null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    /* private mode, blocked storage or a corrupt value — ask again instead */
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * The stored point, read at most once per page load.
 *
 * The `consulted` guard is what makes this a valid snapshot: it returns the
 * same object reference every time until something actually changes, which is
 * what `useSyncExternalStore` requires to avoid an infinite re-render.
 */
function snapshot(): GeoPoint | null {
  if (!consulted) {
    consulted = true;
    remembered = readStored();
  }
  return remembered;
}

function serverSnapshot(): GeoPoint | null {
  return null;
}

function remember(point: GeoPoint | null) {
  consulted = true;
  remembered = point;
  if (typeof window !== "undefined") {
    try {
      if (point) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(point));
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* the point lives for this page load instead of the whole session */
    }
  }
  listeners.forEach((listener) => listener());
}

/* --- what went wrong, in the visitor's words ------------------------------- */

/**
 * `denied` and `unavailable` are two different situations and the section
 * offers two different things. A denial is a decision the browser now enforces,
 * so retrying does nothing and the copy has to point at browser settings; a
 * failed or slow fix is worth another tap.
 */
type Problem = { status: "denied" | "unavailable"; message: string };

const NO_SUPPORT: Problem = {
  status: "unavailable",
  message: "Bu brauzer joylashuvni aniqlay olmaydi. Ro'yxat reyting bo'yicha ko'rsatilmoqda.",
};

function problemFor(code: number): Problem {
  if (code === 1) {
    return {
      status: "denied",
      message:
        "Joylashuvga ruxsat berilmadi. Ro'yxat reyting bo'yicha ko'rsatilmoqda — " +
        "masofalarni ko'rish uchun brauzer sozlamalaridan bu saytga joylashuv ruxsatini bering.",
    };
  }
  if (code === 3) {
    return {
      status: "unavailable",
      message: "Joylashuvni aniqlash cho'zilib ketdi. Qayta urinib ko'ring.",
    };
  }
  return {
    status: "unavailable",
    message: "Joylashuvni aniqlab bo'lmadi. Ochiq joyga chiqib qayta urinib ko'ring.",
  };
}

export type LocationStatus = "idle" | "asking" | "granted" | "denied" | "unavailable";

export type NearbyLocation = {
  status: LocationStatus;
  /** The point to query with, or null — which is a valid thing to query with. */
  point: GeoPoint | null;
  /** Why there is no point, in Uzbek, or null when nothing has gone wrong. */
  message: string | null;
  /** Ask the browser. Safe to call again; a fix already held short-circuits. */
  ask: () => void;
  /** Drop the point and go back to the rating list without asking anything. */
  clear: () => void;
};

export function useNearbyLocation(): NearbyLocation {
  const point = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  // getCurrentPosition has no cancellation, so its callbacks can land after
  // the visitor has navigated away. Writing state then is a no-op warning at
  // best and a leak at worst.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const ask = useCallback(() => {
    if (remembered) return;
    setProblem(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setProblem(NO_SUPPORT);
      return;
    }

    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!alive.current) return;
        setAsking(false);
        remember({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (!alive.current) return;
        setAsking(false);
        setProblem(problemFor(error.code));
      },
      { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: MAX_AGE_MS },
    );
  }, []);

  const clear = useCallback(() => {
    setProblem(null);
    remember(null);
  }, []);

  const status: LocationStatus = asking
    ? "asking"
    : point
      ? "granted"
      : (problem?.status ?? "idle");

  return { status, point, message: problem?.message ?? null, ask, clear };
}
