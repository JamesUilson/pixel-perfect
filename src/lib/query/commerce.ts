import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { safeApi, tokens } from "@/lib/api/client";
import type { CartOut, CheckoutIn, OrderOut } from "@/lib/api/types";
import { qk } from "./keys";

export function useCart() {
  return useQuery({
    queryKey: qk.cart,
    queryFn: () => safeApi<CartOut>("/cart"),
    // Prices and stock are re-checked server-side on every read; do not cache long.
    staleTime: 10_000,
  });
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { offer_id: string; quantity?: number }) =>
      safeApi<CartOut>("/cart/items", { method: "POST", body: input }),
    onSuccess: (cart) => queryClient.setQueryData(qk.cart, cart),
  });
}

export function useSetCartQuantity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      safeApi<CartOut>(`/cart/items/${itemId}`, { method: "PATCH", body: { quantity } }),
    onSuccess: (cart) => queryClient.setQueryData(qk.cart, cart),
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => safeApi<CartOut>(`/cart/items/${itemId}`, { method: "DELETE" }),
    onSuccess: (cart) => queryClient.setQueryData(qk.cart, cart),
  });
}

export function useOrders() {
  return useQuery({
    queryKey: qk.orders,
    queryFn: () => safeApi<OrderOut[]>("/orders"),
    enabled: tokens.isAuthenticated(),
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: qk.order(orderId),
    queryFn: () => safeApi<OrderOut>(`/orders/${orderId}`),
    enabled: tokens.isAuthenticated() && Boolean(orderId),
  });
}

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckoutIn) =>
      safeApi<OrderOut>("/orders/checkout", { method: "POST", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.cart });
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
