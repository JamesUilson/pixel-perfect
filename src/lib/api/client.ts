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

export const tokens = {
  access: () => store.get(ACCESS_KEY),
  refresh: () => store.get(REFRESH_KEY),
  set(pair: { access_token: string; refresh_token: string }) {
    store.set(ACCESS_KEY, pair.access_token);
    store.set(REFRESH_KEY, pair.refresh_token);
  },
  clear() {
    store.set(ACCESS_KEY, null);
    store.set(REFRESH_KEY, null);
  },
  isAuthenticated: () => store.get(ACCESS_KEY) !== null,
};

export const cartToken = {
  get: () => store.get(CART_KEY),
  set: (value: string | null) => store.set(CART_KEY, value),
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
