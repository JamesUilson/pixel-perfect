/**
 * The buyer's own balance: reading it, topping it up, and the cards a top-up
 * is charged to.
 *
 * Every endpoint here is scoped to the caller by the token — there is no path
 * that names a wallet, so nothing in this file takes a user id.
 *
 * Two things the UI built on top of this must not get wrong, and which the
 * types below are shaped to make hard:
 *
 *   - **a top-up is not a credit.** `POST /me/wallet/topup` opens a payment and
 *     returns its status; the balance moves only when the gateway confirms, and
 *     the server credits it exactly once however many times that confirmation
 *     arrives. So `useTopup` invalidates rather than writes an optimistic
 *     balance, and the screen reports the payment's real status.
 *   - **a card number is never stored.** `WalletCardIn.number` goes to the
 *     tokeniser and is gone; nothing that comes back carries it, and
 *     `WalletCardOut` has no field that could.
 *
 * The shapes are written out by hand because `schema.d.ts` is regenerated from
 * the API's OpenAPI document and does not carry the wallet module yet. They
 * follow `app/modules/wallet/schemas.py` field for field, so a regeneration
 * makes them redundant rather than wrong.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { safeApi } from "@/lib/api/client";
import type { CardBrand, Page } from "@/lib/api/types";
import { qk } from "./keys";
import { useIsAuthenticated } from "./session";

/* --- shapes ------------------------------------------------------------------ */
export type WalletCardStatus = "PENDING_VERIFICATION" | "VERIFIED" | "REVOKED" | "FAILED";

export type WalletCardOut = {
  id: string;
  status: WalletCardStatus;
  brand: CardBrand;
  last4: string | null;
  holder_name: string | null;
  bank_name: string | null;
  expires_month: number | null;
  expires_year: number | null;
  is_default: boolean;
  verified_at: string | null;
  created_at: string;
  /** "Kapitalbank ••••1234" — built by the server, never assembled here. */
  display: string;
  /** True only for a VERIFIED card; a pending one cannot be charged. */
  is_usable: boolean;
};

export type WalletOut = {
  /** Decimal, serialised as a string so no precision is lost on the way here. */
  balance: string;
  currency: string;
  lifetime_topped_up: string;
  lifetime_spent: string;
  cards: WalletCardOut[];
};

/** What the tokeniser is given. `number` exists only for the length of the call. */
export type WalletCardIn = {
  number: string;
  expires_month?: number | null;
  expires_year?: number | null;
  holder_name?: string | null;
  make_default?: boolean;
};

export type WalletCardAddedOut = {
  card: WalletCardOut;
  /** Present only where the SMS provider writes to a log instead of to a phone. */
  dev_code: string | null;
};

export type WalletCardCodeResent = { sent: boolean; dev_code: string | null };

export type WalletPaymentStatus =
  "CREATED" | "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";

export type WalletTopupIn = {
  amount: number;
  /** A saved card or a gateway — the server refuses a body with neither. */
  card_id?: string | null;
  gateway?: "CLICK" | "PAYME" | "UZUM_BANK" | "SANDBOX" | null;
  return_url?: string | null;
};

export type WalletTopupOut = {
  id: string;
  amount: string;
  currency: string;
  status: WalletPaymentStatus;
  /** Where to send the buyer to finish paying, when there is anywhere to go. */
  payment_url: string | null;
  reference: string;
};

export type WalletLedgerKind =
  "WALLET_TOPUP" | "WALLET_SPEND" | "REFUND" | "ADJUSTMENT" | (string & {});

export type WalletTransactionOut = {
  id: string;
  created_at: string;
  kind: WalletLedgerKind;
  amount: string;
  currency: string;
  order_id: string | null;
  description: string | null;
  /** Already in Uzbek. The client shows it as given rather than mapping it again. */
  label: string;
};

/** The floor `WalletService.start_topup` enforces, repeated so the form can say so. */
export const MIN_TOPUP = 1000;

/** What the server allows before it gives up on a card's code. */
export const CARD_CODE_MAX_ATTEMPTS = 5;

/** `MAX_CARDS` in `card_service.py`. */
export const MAX_WALLET_CARDS = 5;

/* --- reads ------------------------------------------------------------------- */
export function useWallet() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.wallet,
    queryFn: () => safeApi<WalletOut>("/me/wallet"),
    enabled: signedIn,
  });
}

export function useWalletTransactions(page: number, size = 20) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.walletTransactions(page),
    queryFn: () =>
      safeApi<Page<WalletTransactionOut>>("/me/wallet/transactions", { query: { page, size } }),
    enabled: signedIn,
  });
}

export function useWalletCards() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.walletCards,
    queryFn: () => safeApi<WalletCardOut[]>("/me/wallet/cards"),
    enabled: signedIn,
  });
}

/** Balance, cards and statement together — any of them can move after a write. */
function useWalletInvalidator() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: qk.wallet });
}

/* --- topping up ---------------------------------------------------------------- */
/**
 * Opens a payment. Deliberately does **not** touch the cached balance: the
 * money is not in the wallet until the gateway says so, and a balance the UI
 * invented is one the buyer will try to spend.
 */
export function useTopup() {
  const invalidate = useWalletInvalidator();
  return useMutation({
    mutationFn: (input: WalletTopupIn) =>
      safeApi<WalletTopupOut>("/me/wallet/topup", { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

/* --- cards ---------------------------------------------------------------------- */
export function useAddWalletCard() {
  const invalidate = useWalletInvalidator();
  return useMutation({
    mutationFn: (input: WalletCardIn) =>
      safeApi<WalletCardAddedOut>("/me/wallet/cards", { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useVerifyWalletCard() {
  const invalidate = useWalletInvalidator();
  return useMutation({
    mutationFn: ({ cardId, code }: { cardId: string; code: string }) =>
      safeApi<WalletCardOut>(`/me/wallet/cards/${cardId}/verify`, {
        method: "POST",
        body: { code },
      }),
    onSuccess: invalidate,
  });
}

export function useResendWalletCardCode() {
  const invalidate = useWalletInvalidator();
  return useMutation({
    mutationFn: (cardId: string) =>
      safeApi<WalletCardCodeResent>(`/me/wallet/cards/${cardId}/resend`, { method: "POST" }),
    // A resend resets the server's attempt counter, so the list is re-read.
    onSuccess: invalidate,
  });
}

export function useMakeDefaultWalletCard() {
  const invalidate = useWalletInvalidator();
  return useMutation({
    mutationFn: (cardId: string) =>
      safeApi<WalletCardOut>(`/me/wallet/cards/${cardId}/default`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useRemoveWalletCard() {
  const invalidate = useWalletInvalidator();
  return useMutation({
    mutationFn: (cardId: string) =>
      safeApi<void>(`/me/wallet/cards/${cardId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
