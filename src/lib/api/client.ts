/**
 * The only place in the app that talks HTTP.
 *
 * Responsibilities, deliberately all in one file:
 *   - base URL and JSON handling;
 *   - the access token, and a single in-flight refresh shared by every caller
 *     so a burst of 401s produces one refresh, not ten;
 *   - the guest cart token;
 *   - turning an error response into a typed ApiError with an Uzbek message the
 *     UI can show as-is.
 *
 * Components never call this directly — they use the hooks in `lib/query`.
 */
import type { ApiErrorBody } from "./types";

const BASE = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api/v1";

const isServer = typeof window === "undefined";

/**
 * A relative base is right for the browser — same origin, nginx routes /api to
 * the API — but `fetch("/api/v1/...")` has no origin during server rendering.
 * So on the server a relative base is resolved against the API's internal
 * address, which in production is the API container on the compose network.
 */
const INTERNAL_BASE =
  (typeof process !== "undefined" ? process.env?.["API_INTERNAL_URL"] : undefined) ??
  "http://127.0.0.1:8000";

function origin(): string {
  if (!isServer) return "";
  if (/^https?:\/\//.test(BASE)) return "";
  return INTERNAL_BASE.replace(/\/$/, "");
}

const ACCESS_KEY = "avtoqism.access";
const REFRESH_KEY = "avtoqism.refresh";
const CART_KEY = "avtoqism.cart";
const DEVICE_KEY = "avtoqism.device";

/** SSR-safe storage: on the server every read is null and every write a no-op. */
const store = {
  get(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    if (typeof window === "undefined") return;
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      /* private mode, blocked storage — the app still works, just not remembered */
    }
  },
};

/** Notified when the stored tokens change, so `useIsAuthenticated` can re-read. */
const sessionListeners = new Set<() => void>();

export function onSessionChange(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function announce() {
  sessionListeners.forEach((l) => l());
}

export const tokens = {
  access: () => store.get(ACCESS_KEY),
  refresh: () => store.get(REFRESH_KEY),
  set(pair: { access_token: string; refresh_token: string }) {
    store.set(ACCESS_KEY, pair.access_token);
    store.set(REFRESH_KEY, pair.refresh_token);
    announce();
  },
  clear() {
    store.set(ACCESS_KEY, null);
    store.set(REFRESH_KEY, null);
    announce();
  },
  isAuthenticated: () => store.get(ACCESS_KEY) !== null,
};

export const cartToken = {
  get: () => store.get(CART_KEY),
  set: (value: string | null) => store.set(CART_KEY, value),
};

/**
 * This browser's own id for itself, sent as `X-Device-Id`.
 *
 * It is what lets the connected-devices screen tell one browser from another.
 * The user agent cannot: two identical Chrome installs send the same string,
 * so the server would either list every sign-in as a separate device — which
 * it used to — or sign a second person out of a shared account.
 *
 * Generated once and kept, deliberately outliving sign-out: the point is to
 * recognise the *machine*, and clearing it on sign-out would make the next
 * sign-in look like a new laptop. It is random and means nothing on its own —
 * it identifies a browser to this API and is not a fingerprint of the person.
 *
 * On the server there is no such thing, so this answers null there and the
 * header is simply absent, which the API reads as "not a browser".
 */
function newDeviceId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return random;
  // Older Safari has no randomUUID. Any unique-enough string will do — the
  // server never interprets it.
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const deviceId = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    const existing = store.get(DEVICE_KEY);
    if (existing) return existing;
    const minted = newDeviceId();
    store.set(DEVICE_KEY, minted);
    // Blocked storage means a new id per request, which is no worse than the
    // no-id behaviour it replaces: the server just never collapses anything.
    return store.get(DEVICE_KEY) ?? minted;
  },
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;
  readonly incidentId: string | undefined;

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    const message = body?.error?.message ?? fallback;
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error?.code ?? "unknown_error";
    this.details = body?.error?.details;
    this.incidentId = body?.error?.incident_id;
  }

  /** True when retrying the same request could plausibly work. */
  get isRetryable() {
    return this.status >= 500 || this.status === 429;
  }
}

// `exactOptionalPropertyTypes` is on, so every optional field spells out
// `| undefined` — callers routinely pass a conditional that may be undefined.
type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | undefined;
  body?: unknown;
  query?: Record<string, unknown> | undefined;
  /** Skip the Authorization header (used by the refresh call itself). */
  anonymous?: boolean | undefined;
  signal?: AbortSignal | undefined;
};

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const url = `${origin()}${BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** One shared refresh promise, so concurrent 401s do not each rotate a token. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokens.refresh();
  if (!refresh) return false;

  refreshInFlight ??= (async () => {
    try {
      const resp = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!resp.ok) {
        tokens.clear();
        return false;
      }
      tokens.set(await resp.json());
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, anonymous = false, signal } = options;

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const access = tokens.access();
    if (!anonymous && access) headers["Authorization"] = `Bearer ${access}`;

    const cart = cartToken.get();
    if (cart) headers["X-Cart-Token"] = cart;

    const device = deviceId.get();
    if (device) headers["X-Device-Id"] = device;

    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    if (signal) init.signal = signal;

    return fetch(buildUrl(path, query), init);
  };

  let response = await send();

  // One transparent retry after refreshing, then give up.
  if (response.status === 401 && !anonymous && tokens.refresh()) {
    if (await refreshAccessToken()) response = await send();
  }

  const returned = response.headers.get("X-Cart-Token");
  if (returned) cartToken.set(returned);

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      parsed as ApiErrorBody | null,
      "Serverga ulanishda xatolik yuz berdi.",
    );
  }
  return parsed as T;
}

/** A network failure produces an ApiError too, so the UI has one error type. */
export async function safeApi<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await api<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, null, "Internet aloqasi yo'q. Qayta urinib ko'ring.");
  }
}
