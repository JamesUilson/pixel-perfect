import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api, cartToken, safeApi, tokens } from "@/lib/api/client";
import { useIsAuthenticated } from "./session";
import type { AuthResult, CartOut, TokenPair, UserOut } from "@/lib/api/types";
import { qk } from "./keys";

/* --- shapes the generated schema does not carry yet ---------------------------
 * `schema.d.ts` is regenerated from the API's OpenAPI document and is behind on
 * the profile fields and, more importantly, on `is_verified` — the one flag that
 * decides whether this account may check out or open a store. These aliases add
 * exactly the fields `UserOut.of` already sends, so a regeneration makes them
 * redundant rather than wrong.
 */
export type AccountUser = UserOut & {
  region?: string | null;
  city?: string | null;
  /** True once the phone or the e-mail on file has been proved. */
  is_verified?: boolean | undefined;
  terms_version?: string | null;
};

/** Signed in, but the contact has not been proved yet. */
export function isUnverified(user: AccountUser | undefined): boolean {
  return user !== undefined && user.is_verified === false;
}

/** The identity this account verifies with — a phone if there is one. */
export function verificationIdentifier(user: AccountUser | undefined): string | null {
  if (!user) return null;
  if (user.phone && !user.phone_verified) return user.phone;
  if (user.email && !user.email_verified) return user.email;
  return null;
}

export function useMe() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.me,
    queryFn: () => safeApi<AccountUser>("/auth/me"),
    // No token means no request: an anonymous visitor is a normal state, not an error.
    enabled: signedIn,
    retry: (count, error) =>
      error instanceof ApiError && error.status === 401 ? false : count < 2,
    staleTime: 5 * 60_000,
  });
}

/** After signing in, adopt the guest cart so nothing the visitor picked is lost. */
async function adoptGuestCart(queryClient: ReturnType<typeof useQueryClient>) {
  const guest = cartToken.get();
  try {
    await api<CartOut>("/cart/merge", { method: "POST" });
  } catch {
    /* merging is best effort; never block a successful login on it */
  } finally {
    if (guest) cartToken.set(null);
    await queryClient.invalidateQueries({ queryKey: ["cart"] });
  }
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    // `AuthResult` from the generated schema still carries the stale `UserOut`,
    // and the sign-in page has to branch on `is_verified` — so the widened
    // account type is what the response is read as.
    mutationFn: (input: { identifier: string; password: string }) =>
      safeApi<AuthResult & { user: AccountUser }>("/auth/login", {
        method: "POST",
        body: input,
        anonymous: true,
      }),
    onSuccess: async (result) => {
      tokens.set(result.tokens);
      queryClient.setQueryData(qk.me, result.user);
      await adoptGuestCart(queryClient);
      await queryClient.invalidateQueries({ queryKey: qk.garage });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { phone?: string; email?: string; password: string; full_name: string }) =>
      safeApi<AuthResult>("/auth/register", { method: "POST", body: input, anonymous: true }),
    onSuccess: async (result) => {
      tokens.set(result.tokens);
      queryClient.setQueryData(qk.me, result.user);
      await adoptGuestCart(queryClient);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const refresh = tokens.refresh();
      if (refresh) {
        try {
          await api<void>("/auth/logout", { method: "POST", body: { refresh_token: refresh } });
        } catch {
          /* the local session is cleared either way */
        }
      }
    },
    onSettled: async () => {
      tokens.clear();
      cartToken.set(null);
      queryClient.clear();
    },
  });
}

/* --- the two-step registration flow ------------------------------------------
 * `/auth/register/start` deliberately answers the same whether or not the
 * contact is already in use, so none of the hooks below may be used to work out
 * that a number is taken — and the screens built on them must not pretend to.
 * The account is only signed in at `/auth/register/verify`, which is where the
 * tokens come from.
 */

/** Constant, enumeration-safe body. Every field is the same for everybody. */
export type RegistrationStarted = {
  status: string;
  message: string;
  /** Seconds the code stays valid. */
  expires_in: number;
  /** Seconds before another code may be asked for. */
  resend_after: number;
};

/** `RegistrationStartIn` — the strict form: region and the terms tick required. */
export type RegistrationStartInput = {
  phone?: string | undefined;
  email?: string | undefined;
  password: string;
  full_name: string;
  region: string;
  city?: string | undefined;
  locale?: "uz" | "ru" | "en" | undefined;
  accept_terms: boolean;
};

export type VerificationResult = {
  user: AccountUser;
  tokens: TokenPair;
  /** Only ever populated outside production, and shown clearly marked as such. */
  verification?: { sent: boolean; expires_in: number; debug_code?: string | null } | null;
};

export function useRegisterStart() {
  return useMutation({
    mutationFn: (input: RegistrationStartInput) =>
      safeApi<RegistrationStarted>("/auth/register/start", {
        method: "POST",
        body: input,
        anonymous: true,
      }),
  });
}

/** Another code for the same contact. Refused inside the server's cooldown. */
export function useRegisterResend() {
  return useMutation({
    mutationFn: (identifier: string) =>
      safeApi<RegistrationStarted>("/auth/register/resend", {
        method: "POST",
        body: { identifier },
        anonymous: true,
      }),
  });
}

/**
 * The code, and with it the session.
 *
 * `anonymous` is not set: a signed-in but unverified person verifying from
 * their profile is the same call, and the tokens it returns replace the ones
 * they already hold.
 */
export function useRegisterVerify() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { identifier: string; code: string }) =>
      safeApi<VerificationResult>("/auth/register/verify", { method: "POST", body: input }),
    onSuccess: async (result) => {
      tokens.set(result.tokens);
      queryClient.setQueryData(qk.me, result.user);
      await adoptGuestCart(queryClient);
      await queryClient.invalidateQueries({ queryKey: qk.garage });
    },
  });
}
