import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api, cartToken, safeApi, tokens } from "@/lib/api/client";
import { useIsAuthenticated } from "./session";
import type { AuthResult, CartOut, UserOut } from "@/lib/api/types";
import { qk } from "./keys";

export function useMe() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.me,
    queryFn: () => safeApi<UserOut>("/auth/me"),
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
    mutationFn: (input: { identifier: string; password: string }) =>
      safeApi<AuthResult>("/auth/login", { method: "POST", body: input, anonymous: true }),
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
