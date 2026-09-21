/**
 * The buyer's saved delivery addresses — `/me/addresses`.
 *
 * Kept out of `commerce.ts` because the address book outlives any one order:
 * the profile screen manages it, and checkout only borrows from it.
 *
 * The types are written by hand rather than taken from `lib/api/schema.d.ts`.
 * That file is generated from an OpenAPI document that predates this endpoint,
 * and regenerating it is not this change's job.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { safeApi } from "@/lib/api/client";
import { qk } from "./keys";
import { useIsAuthenticated } from "./session";

/**
 * Coordinates arrive as strings: the column is `Numeric(9, 6)` and Pydantic
 * serialises a Decimal as a string so the exact value survives the trip. A
 * runtime that hands back a number is tolerated rather than trusted.
 */
export type Coordinate = string | number | null;

export type AddressOut = {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  region: string;
  district: string;
  street: string;
  house: string | null;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  lat: Coordinate;
  lng: Coordinate;
  is_default: boolean;
  /** Already formatted by the server, so no client re-implements the order. */
  line: string;
  maps_url: string | null;
  navigator_url: string | null;
};

/** What `POST`/`PUT /me/addresses` accepts. Every field is spelled out, so a
 *  half-filled form cannot silently drop one. */
export type AddressInput = {
  label: string | null;
  recipient_name: string;
  phone: string;
  region: string;
  district: string;
  street: string;
  house: string | null;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
};

/** The server caps the book; the UI hides "add" at the same number. */
export const MAX_ADDRESSES = 10;

export function useAddresses() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.addresses,
    queryFn: () => safeApi<AddressOut[]>("/me/addresses"),
    enabled: signedIn,
    staleTime: 60_000,
  });
}

/** Every write answers with the row, but the default flag moves between rows,
 *  so the whole list is refetched rather than patched in place. */
function useAddressMutation<TInput>(send: (input: TInput) => Promise<AddressOut | void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.addresses });
    },
  });
}

export function useCreateAddress() {
  return useAddressMutation((input: AddressInput) =>
    safeApi<AddressOut>("/me/addresses", { method: "POST", body: input }),
  );
}

export function useUpdateAddress() {
  return useAddressMutation(({ id, input }: { id: string; input: AddressInput }) =>
    safeApi<AddressOut>(`/me/addresses/${id}`, { method: "PUT", body: input }),
  );
}

export function useSetDefaultAddress() {
  return useAddressMutation((id: string) =>
    safeApi<AddressOut>(`/me/addresses/${id}/default`, { method: "POST" }),
  );
}

export function useDeleteAddress() {
  return useAddressMutation((id: string) =>
    safeApi<void>(`/me/addresses/${id}`, { method: "DELETE" }),
  );
}
