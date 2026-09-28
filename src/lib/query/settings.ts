/**
 * Everything the settings screen reads and writes.
 *
 * Two kinds of state live here and they are deliberately kept apart:
 *
 *   - **Visual preferences** — theme, reduced motion, larger text, high
 *     contrast. These have to work for a signed-out visitor and they have to be
 *     applied before the first paint, so the browser owns them: a module-level
 *     store, localStorage, and attributes on `<html>` that `styles.css` keys
 *     off. The server is a mirror, not the source.
 *   - **Account settings** — sessions, the security summary, notification
 *     channels, closing the account. These only exist for a signed-in person
 *     and the server is the only authority, so they are ordinary queries.
 *
 * The store is `useSyncExternalStore` for the same reason `session.ts` is: the
 * server render cannot read localStorage, so a snapshot read during render
 * would be a hydration mismatch. The server snapshot is the documented default
 * and the browser re-reads after hydration — by which time the inline bootstrap
 * in `__root.tsx` has already put the right attributes on `<html>`, so nothing
 * flashes even though React does not know the answer yet.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import { cartToken, safeApi, tokens } from "@/lib/api/client";
import type { AccountUser } from "./auth";
import { qk } from "./keys";
import { useIsAuthenticated } from "./session";

/* --- visual preferences, browser-side ---------------------------------------- */

export type ThemeChoice = "light" | "dark" | "system";

export type VisualPreferences = {
  theme: ThemeChoice;
  /** Turns off autoplay, the slider and every transition. */
  reducedMotion: boolean;
  /** Scales the root font size, so every rem-based size grows with it. */
  largerText: boolean;
  /** Darker borders and muted text, for a screen in the sun. */
  highContrast: boolean;
};

export const DEFAULT_VISUAL_PREFERENCES: VisualPreferences = {
  theme: "system",
  reducedMotion: false,
  largerText: false,
  highContrast: false,
};

/**
 * The localStorage key and the shape inside it.
 *
 * The same constant is spelled out in the bootstrap script in `__root.tsx`,
 * which runs before any module is evaluated and therefore cannot import it. The
 * two must agree; the comment there says so as well.
 */
export const VISUAL_PREFERENCES_KEY = "avtoqism.appearance";

function readStored(): VisualPreferences {
  if (typeof window === "undefined") return DEFAULT_VISUAL_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(VISUAL_PREFERENCES_KEY);
    if (!raw) return DEFAULT_VISUAL_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_VISUAL_PREFERENCES;
    const record = parsed as Record<string, unknown>;
    const theme = record["theme"];
    return {
      theme: theme === "light" || theme === "dark" || theme === "system" ? theme : "system",
      reducedMotion: record["reducedMotion"] === true,
      largerText: record["largerText"] === true,
      highContrast: record["highContrast"] === true,
    };
  } catch {
    // Private mode, blocked storage, or somebody hand-edited the value.
    return DEFAULT_VISUAL_PREFERENCES;
  }
}

/**
 * Has anybody chosen on this device yet?
 *
 * This decides who wins when the account and the browser disagree: the account's
 * stored preference is adopted only on a device that has never been asked. Once
 * somebody has picked here, picking again is what changes it — signing in does
 * not reach over and flip the screen they are looking at.
 */
export function hasStoredVisualPreferences(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(VISUAL_PREFERENCES_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * The attributes `styles.css` reads.
 *
 * `data-theme` is left off for "system" on purpose: that is what lets the
 * `prefers-color-scheme` rule in the stylesheet decide, which is also the
 * answer a visitor with JavaScript disabled gets. The `dark` class is kept in
 * step because `@custom-variant dark` and `components/ui/chart.tsx` both key
 * off it.
 */
function applyToDocument(prefs: VisualPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (prefs.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", prefs.theme);

  const systemDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && systemDark);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";

  root.toggleAttribute("data-reduce-motion", prefs.reducedMotion);
  root.toggleAttribute("data-text-lg", prefs.largerText);
  root.toggleAttribute("data-high-contrast", prefs.highContrast);
}

let current: VisualPreferences = DEFAULT_VISUAL_PREFERENCES;
let hydrated = false;
const listeners = new Set<() => void>();

function snapshot(): VisualPreferences {
  // The first browser read happens here rather than at module scope, so this
  // module stays importable on the server.
  if (!hydrated && typeof window !== "undefined") {
    current = readStored();
    hydrated = true;
  }
  return current;
}

function serverSnapshot(): VisualPreferences {
  return DEFAULT_VISUAL_PREFERENCES;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  // Another tab changing the theme, and the OS changing it under "system",
  // should both reach this tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== VISUAL_PREFERENCES_KEY) return;
    current = readStored();
    applyToDocument(current);
    onChange();
  };
  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  const onScheme = () => {
    if (current.theme !== "system") return;
    applyToDocument(current);
    onChange();
  };

  window.addEventListener("storage", onStorage);
  media?.addEventListener("change", onScheme);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
    media?.removeEventListener("change", onScheme);
  };
}

/** Writes, applies and announces in one step; nothing else may mutate `current`. */
export function setVisualPreferences(patch: Partial<VisualPreferences>): void {
  const next = { ...snapshot(), ...patch };
  current = next;
  hydrated = true;
  applyToDocument(next);
  try {
    window.localStorage.setItem(VISUAL_PREFERENCES_KEY, JSON.stringify(next));
  } catch {
    /* not remembered across reloads, but applied for this one */
  }
  listeners.forEach((listener) => listener());
}

/**
 * "Should this surface move on its own?" — for code outside React's render, and
 * for anything that starts playback rather than animating.
 *
 * CSS handles every transition and animation from the `data-reduce-motion`
 * attribute (see `styles.css`), but a `<video>` that autoplays has to be asked
 * not to start, and that is a JavaScript decision. Answers true for the OS
 * preference as well, so a person who set it once at system level is not asked
 * to set it again here.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (snapshot().reducedMotion) return true;
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useVisualPreferences(): VisualPreferences {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** True when "system" currently resolves to dark — the swatch needs to know. */
export function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media =
        typeof window !== "undefined" && typeof window.matchMedia === "function"
          ? window.matchMedia("(prefers-color-scheme: dark)")
          : null;
      media?.addEventListener("change", onChange);
      return () => media?.removeEventListener("change", onChange);
    },
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}

/* --- the same preferences, on the server ------------------------------------- *
 * Everything below mirrors `app/modules/settings/` exactly — `schemas.py` for the
 * shapes, `router.py` for the paths. The types are written by hand rather than
 * taken from `lib/api/schema.d.ts`, which is generated from an OpenAPI document
 * that predates this module; regenerating it is not this change's job.
 */

/** `UiTheme`. The same three values the browser store uses, deliberately. */
export type ServerTheme = ThemeChoice;

/** `UiLanguage` — narrower than `users.locale`, which still accepts `en`. */
export type ServerLanguage = "uz" | "ru";

/**
 * `NotificationKind`, restricted to `NOTIFIABLE_KINDS`.
 *
 * The server sends exactly the kinds something in the codebase can actually
 * produce, so the screen renders whatever arrives rather than a hard-coded list:
 * a kind that becomes notifiable appears here without a frontend change, and one
 * that is withdrawn disappears instead of becoming a switch that does nothing.
 */
export type NotificationKind =
  "ORDER_STATUS" | "BACK_IN_STOCK" | "COMMENT" | "FOLLOW" | "MODERATION";

/** `NotificationChannelsOut`. `in_app` is on by default; `sms` costs money. */
export type NotificationChannels = {
  kind: NotificationKind | string;
  in_app: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
};

export const NOTIFICATION_CHANNELS = [
  { key: "in_app", label: "Ilovada" },
  { key: "push", label: "Push" },
  { key: "email", label: "E-pochta" },
  { key: "sms", label: "SMS" },
] as const;

export type NotificationChannelKey = (typeof NOTIFICATION_CHANNELS)[number]["key"];

/** `PreferencesOut`. */
export type ServerPreferences = {
  language: ServerLanguage;
  theme: ServerTheme;
  reduced_motion: boolean;
  larger_text: boolean;
  high_contrast: boolean;
  notifications: NotificationChannels[];
};

/** `NotificationChannelsIn` — an omitted channel is left alone server-side. */
export type NotificationChannelsPatch = { kind: string } & Partial<
  Record<NotificationChannelKey, boolean>
>;

/** `PreferencesIn`. Every field optional, and omission never means "off". */
export type PreferencesPatch = {
  language?: ServerLanguage;
  theme?: ServerTheme;
  reduced_motion?: boolean;
  larger_text?: boolean;
  high_contrast?: boolean;
  notifications?: NotificationChannelsPatch[];
};

export function usePreferences() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.preferences,
    queryFn: () => safeApi<ServerPreferences>("/me/preferences"),
    // An anonymous visitor has no server preferences, and the ones they do have
    // are in localStorage already.
    enabled: signedIn,
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: PreferencesPatch) =>
      safeApi<ServerPreferences>("/me/preferences", { method: "PATCH", body: patch }),
    // The response is the whole of the new state, so it replaces the cache
    // rather than invalidating it — one round trip instead of two.
    onSuccess: (result) => {
      queryClient.setQueryData(qk.preferences, result);
    },
  });
}

/**
 * Mirror a visual choice to the server, for a signed-in person only.
 *
 * Deliberately fire-and-forget: the choice is already applied and already in
 * localStorage, so a failed `PATCH` costs this device nothing. A toast saying
 * "your theme did not sync" would be noise about something the person can see is
 * working.
 */
export function mirrorPreference(patch: PreferencesPatch): void {
  if (!tokens.isAuthenticated()) return;
  void safeApi<ServerPreferences>("/me/preferences", { method: "PATCH", body: patch }).catch(
    () => undefined,
  );
}

/**
 * Adopt the account's stored appearance, once, on a device that has never chosen.
 *
 * Called from `LangProvider`, which is the one component mounted above the whole
 * app and inside the query client — so this runs for every screen, not only for
 * the settings screen where these choices are made. A signed-in person opening
 * the app on a borrowed laptop gets the dark theme they set at home; the moment
 * they touch a switch here, this stops having an opinion.
 */
export function useAdoptServerVisualPreferences(): void {
  const prefs = usePreferences();
  const data = prefs.data;

  useEffect(() => {
    if (data === undefined || hasStoredVisualPreferences()) return;
    setVisualPreferences({
      theme: data.theme,
      reducedMotion: data.reduced_motion,
      largerText: data.larger_text,
      highContrast: data.high_contrast,
    });
  }, [data]);
}

/* --- signed-in devices ------------------------------------------------------- */

/** `SessionOut`. */
export type SessionOut = {
  id: string;
  created_at: string;
  /**
   * When this session last swapped its refresh token for a new access token —
   * *not* its last request. The server says so in `AuthSession.last_used_at` and
   * the card repeats the caveat, because "last activity" that lags by an access
   * token's lifetime would otherwise look like a bug.
   */
  last_used_at: string | null;
  expires_at: string;
  ip_address: string | null;
  /** Already parsed from the user agent by `settings/user_agent.py`. */
  device: string;
  user_agent: string | null;
  is_current: boolean;
};

/** `SessionListOut` — a list plus the caveat, said once for the whole list. */
export type SessionListOut = {
  sessions: SessionOut[];
  note: string;
};

export function useSessions() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.sessions,
    queryFn: () => safeApi<SessionListOut>("/me/sessions"),
    enabled: signedIn,
    // A device list that is stale is a device list that is wrong, and this is
    // the screen somebody opens *because* they suspect something.
    staleTime: 0,
  });
}

export function useEndSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      safeApi<void>(`/me/sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.sessions });
      await queryClient.invalidateQueries({ queryKey: qk.security });
    },
  });
}

/** `RevokedOut` — how many were ended, and a sentence to show. */
export type RevokedOut = { revoked: number; message: string };

/**
 * Everything except the browser making the request.
 *
 * The server decides which one is current from the access token's `sid` claim,
 * so this cannot be asked to spare somebody else's session — and when the claim
 * is missing it ends every session, which is the right way for this particular
 * button to fail.
 */
export function useEndOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => safeApi<RevokedOut>("/me/sessions/revoke-others", { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.sessions });
      await queryClient.invalidateQueries({ queryKey: qk.security });
    },
  });
}

/* --- the security summary ---------------------------------------------------- */

/** `PendingContactOut` — asked for, not yet proved by code. */
export type PendingContactOut = {
  channel: ContactChannelKey;
  value: string;
  requested_at: string;
};

/** `SecurityOut`. */
export type SecuritySummary = {
  phone: string | null;
  phone_verified: boolean;
  email: string | null;
  email_verified: boolean;
  password_set: boolean;
  /** Null for an account whose password predates the column. Never guessed at. */
  password_changed_at: string | null;
  active_sessions: number;
  pending_contacts: PendingContactOut[];
};

export function useSecuritySummary() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.security,
    queryFn: () => safeApi<SecuritySummary>("/me/security"),
    enabled: signedIn,
    staleTime: 60_000,
  });
}

/**
 * `POST /auth/password/change`.
 *
 * It answers 204 and then **revokes every session, including this one** — which
 * is the right behaviour (if the reason for changing a password is that somebody
 * else knows the old one, their session is not something to reason carefully
 * about keeping) and is also why this hook does not simply invalidate a query.
 *
 * Nothing on the account is readable a moment later: `get_current_user_optional`
 * now refuses a token whose session is revoked, so the very next request 401s,
 * the refresh token it would retry with is revoked too, and the client clears
 * itself. Refetching the security summary here would race that 401 for no
 * reason. So the local session is cleared deliberately and the screen says the
 * person has been signed out everywhere — rather than letting them discover it
 * when the page silently empties.
 */
export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { current_password: string; new_password: string }) =>
      safeApi<void>("/auth/password/change", { method: "POST", body: input }),
    onSuccess: () => {
      tokens.clear();
      cartToken.set(null);
      queryClient.clear();
    },
  });
}

/* --- changing the verified phone or e-mail ----------------------------------- */

/** `ContactChannel`. Upper-case on the wire, unlike the language enum. */
export type ContactChannelKey = "PHONE" | "EMAIL";

/** `ContactChangeStarted`. 202 — nothing on the account has changed yet. */
export type ContactChangeStarted = {
  channel: ContactChannelKey;
  value: string;
  sent: boolean;
  expires_in: number;
  message: string;
  /** Only outside production, and shown clearly marked as such. */
  debug_code: string | null;
};

/**
 * Ask for the change. The contact on file is untouched until the code comes back,
 * so a mistyped number cannot lock anybody out of their own account.
 *
 * There is no separate resend endpoint: calling this again issues a new code,
 * which is what the screen's "resend" does. The rate limit (5/hour) is the same
 * either way, so nothing is gained by a second path.
 */
export function useStartContactChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { channel: ContactChannelKey; value: string }) =>
      safeApi<ContactChangeStarted>("/me/security/contacts", { method: "POST", body: input }),
    onSuccess: async () => {
      // A pending change shows up in the summary, so it is refetched even though
      // the contact itself has not moved.
      await queryClient.invalidateQueries({ queryKey: qk.security });
    },
  });
}

/** The code, and with it the change. Answers with the whole new summary. */
export function useVerifyContactChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { channel: ContactChannelKey; value: string; code: string }) =>
      safeApi<SecuritySummary>("/me/security/contacts/verify", { method: "POST", body: input }),
    onSuccess: async (result) => {
      queryClient.setQueryData(qk.security, result);
      // `/auth/me` carries the contacts and `is_verified` too, and both may have
      // just moved — a verified new phone can verify a previously unverified
      // account.
      await queryClient.invalidateQueries({ queryKey: qk.me });
    },
  });
}

/* --- closing the account ----------------------------------------------------- */

/** `RetentionNote` — what, and why it is kept or removed. */
export type RetentionNote = { what: string; why: string };

/**
 * `AccountClosedOut`.
 *
 * Not a 204: the server answers with what it keeps and why, at the moment the
 * person asks. That answer is what the screen shows afterwards — the lists are
 * the server's, not a second copy written here that could drift from the
 * retention policy it describes.
 */
export type AccountClosedOut = {
  status: string;
  closed_at: string;
  sessions_ended: number;
  message: string;
  kept: RetentionNote[];
  removed: RetentionNote[];
};

/**
 * `DELETE /me`.
 *
 * The body carries a reason and nothing else. It deliberately does *not* ask for
 * the password: `AccountCloseIn` has no such field, and a password box the server
 * ignores is worse than none — it promises a check that is not happening. The
 * two-step confirmation on the screen is the whole of the friction.
 */
export function useCloseAccount() {
  return useMutation({
    mutationFn: (input: { reason?: string | undefined }) =>
      safeApi<AccountClosedOut>("/me", {
        method: "DELETE",
        body: input.reason === undefined ? {} : { reason: input.reason },
      }),
  });
}
