import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { safeApi } from "@/lib/api/client";
import { useIsAuthenticated } from "./session";
import type { CartOut, CheckoutIn, OrderOut } from "@/lib/api/types";
import { qk } from "./keys";

/**
 * The cart, priced by the server.
 *
 * A promo code is a query parameter rather than something stored: the server
 * re-prices the whole cart with it and answers both what it took off and, if
 * it did nothing, why. So a wrong code is a different cart, not an error.
 */
/**
 * Seed the plain cart and drop any promo-coded variant.
 *
 * A mutation's response was priced without whatever code the user had typed,
 * so writing it into the coded key would show them a cart with the discount
 * silently gone. Refetching that key is the honest move.
 */
function cacheCart(queryClient: ReturnType<typeof useQueryClient>, cart: CartOut) {
  queryClient.setQueryData(qk.cart(null), cart);
  void queryClient.invalidateQueries({
    queryKey: ["cart"],
    predicate: (query) => query.queryKey[1] !== null,
  });
}

export function useCart(promoCode?: string | null) {
  return useQuery({
    queryKey: qk.cart(promoCode),
    queryFn: () => safeApi<CartOut>("/cart", { query: { promo_code: promoCode } }),
    // Prices and stock are re-checked server-side on every read; do not cache long.
    staleTime: 10_000,
    // Applying a code is a different cache key. Without this the whole cart
    // would blink back to a skeleton on every attempt; with it the old prices
    // stay put for the moment it takes, flagged by `isPlaceholderData`.
    placeholderData: keepPreviousData,
  });
}

/* --- the applied promo code ------------------------------------------------
 *
 * The cart owns the code as component state, but checkout has to charge what
 * the cart showed, so the code has to survive the hop between the two routes.
 * A tiny module-level store does that.
 *
 * Deliberately not persisted: losing the code on a refresh is a mild annoyance
 * the buyer fixes by retyping it, whereas a stale code silently outliving the
 * cart that priced it is how someone gets charged full price after being shown
 * a discount. Checkout re-reads the cart with whatever is here, so the total it
 * shows is always the total the server will charge.
 * --------------------------------------------------------------------------- */
let appliedPromoCode: string | null = null;
const promoListeners = new Set<() => void>();

export function getAppliedPromoCode(): string | null {
  return appliedPromoCode;
}

export function setAppliedPromoCode(code: string | null): void {
  const next = code?.trim() ? code.trim() : null;
  if (next === appliedPromoCode) return;
  appliedPromoCode = next;
  promoListeners.forEach((listener) => listener());
}

function subscribeToPromoCode(listener: () => void): () => void {
  promoListeners.add(listener);
  return () => {
    promoListeners.delete(listener);
  };
}

/** Null on the server and on the first client render, so hydration matches. */
export function useAppliedPromoCode(): string | null {
  return useSyncExternalStore(subscribeToPromoCode, getAppliedPromoCode, () => null);
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { offer_id: string; quantity?: number }) =>
      safeApi<CartOut>("/cart/items", { method: "POST", body: input }),
    onSuccess: (cart) => cacheCart(queryClient, cart),
  });
}

export function useSetCartQuantity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      safeApi<CartOut>(`/cart/items/${itemId}`, { method: "PATCH", body: { quantity } }),
    onSuccess: (cart) => cacheCart(queryClient, cart),
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => safeApi<CartOut>(`/cart/items/${itemId}`, { method: "DELETE" }),
    onSuccess: (cart) => cacheCart(queryClient, cart),
  });
}

export function useOrders() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.orders,
    queryFn: () => safeApi<OrderOut[]>("/orders"),
    enabled: signedIn,
  });
}

export function useOrder(orderId: string) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.order(orderId),
    queryFn: () => safeApi<OrderOut>(`/orders/${orderId}`),
    enabled: signedIn && Boolean(orderId),
  });
}

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckoutIn) =>
      safeApi<OrderOut>("/orders/checkout", { method: "POST", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: qk.orders });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note?: string }) =>
      safeApi<OrderOut>(`/orders/${orderId}/cancel`, {
        method: "POST",
        body: { status: "CANCELLED", note },
      }),
    onSuccess: (order) => {
      queryClient.setQueryData(qk.order(order.id), order);
      void queryClient.invalidateQueries({ queryKey: qk.orders });
    },
  });
}
