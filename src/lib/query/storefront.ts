/**
 * Storefront-side hooks that are not the cart, the catalogue or the garage.
 *
 * Today that means the ad slots: the endpoint that hands back whatever should
 * be shown in a placement, and the endpoint that records that it was seen or
 * clicked. Paid campaigns and free house banners come back from the same call
 * already merged, so nothing here has to know which is which — only the UI
 * does, to mark the paid ones.
 */
import { useMutation, useQuery } from "@tanstack/react-query";

import { safeApi } from "@/lib/api/client";
import type { AdEventKind, AdSlot, SlideOut } from "@/lib/api/types";
import { qk } from "./keys";

/* --- slot content ---------------------------------------------------------- */
export type AdSlotParams = {
  category_id?: string | undefined;
  model_id?: string | undefined;
  region?: string | undefined;
  limit?: number | undefined;
};

/**
 * What to show in one placement.
 *
 * A couple of minutes of staleness is right: the rotation is decided server
 * side and a visitor moving between pages should not re-ask on every hop, but
 * a campaign that runs out of budget should disappear within a few minutes.
 */
export function useAdSlot(slot: AdSlot, params: AdSlotParams = {}) {
  return useQuery({
    queryKey: qk.adSlot(slot, params),
    queryFn: () => safeApi<SlideOut[]>(`/ads/slots/${slot}`, { query: params }),
    staleTime: 2 * 60_000,
    // Advertising is never worth three round trips; a slot that fails just
    // does not render.
    retry: 1,
  });
}

/* --- events ---------------------------------------------------------------- */
const SESSION_KEY = "avtoqism.ad-session";

/** Module-level so every slider on the page reports the same browser session. */
let adSession: string | null = null;

/**
 * The id the server de-duplicates impressions by.
 *
 * Never call this during render. It touches `sessionStorage` and `crypto`,
 * neither of which exists on the server, so a value read while rendering would
 * differ between the server pass and the first client pass and break
 * hydration. Event handlers and effects only.
 *
 * Returns null when there is no way to make an id; `session_id` is optional on
 * the endpoint, so the event is still recorded, just without de-duplication.
 */
function adSessionId(): string | null {
  if (adSession) return adSession;
  if (typeof window === "undefined") return null;

  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      adSession = stored;
      return adSession;
    }
  } catch {
    /* private mode or blocked storage — a fresh id per page load still works */
  }

  try {
    adSession = window.crypto.randomUUID();
  } catch {
    return null;
  }

  try {
    window.sessionStorage.setItem(SESSION_KEY, adSession);
  } catch {
    /* ignore — the id lives for this page load instead of the whole session */
  }
  return adSession;
}

export type AdEventInput = {
  kind: AdEventKind;
  campaign_id?: string | null | undefined;
  banner_id?: string | null | undefined;
  creative_id?: string | null | undefined;
};

/**
 * Record an impression or a click.
 *
 * Fire-and-forget by design: `mutate` never rejects, nothing here shows a
 * toast, and the mutation's error state is deliberately never read. A visitor
 * must not learn that our analytics call failed.
 */
export function useRecordAdEvent() {
  return useMutation({
    mutationFn: async (input: AdEventInput) => {
      const session = adSessionId();
      await safeApi<void>("/ads/events", {
        method: "POST",
        body: input,
        query: session ? { session_id: session } : undefined,
      });
    },
    retry: false,
  });
}

/* --- purchase summary ------------------------------------------------------
 * There is intentionally no `usePurchaseSummary` here.
 *
 * `src/lib/api/schema.d.ts` has no `/me/purchase-summary` path — in fact no
 * `/me/*` path at all — so a hook for it would be an invented endpoint that
 * 404s in production. The buyer's totals (spent, saved, order count, orders in
 * progress, average order value) are therefore derived on the client from
 * `useOrders()` in `src/routes/profile.tsx`, which already returns every order
 * with the figures those totals need. `qk.purchaseSummary` stays unused in
 * `keys.ts` until the endpoint exists.
 * --------------------------------------------------------------------------- */
