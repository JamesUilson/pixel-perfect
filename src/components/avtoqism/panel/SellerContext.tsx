/**
 * Which store the seller panel is currently looking at.
 *
 * One person can own more than one store — a parts shop and a tyre shop are
 * two stores with two sets of books — so every panel screen reads the active
 * one from here rather than from the URL. Keeping it out of the URL means
 * switching stores does not invalidate every deep link the person has saved.
 */
import { createContext, useContext } from "react";

import type { SellerOut } from "@/lib/api/types";

export type SellerScope = {
  seller: SellerOut;
  sellers: SellerOut[];
  setSellerId: (id: string) => void;
};

const SellerScopeContext = createContext<SellerScope | null>(null);

export const SellerScopeProvider = SellerScopeContext.Provider;

export function useSellerScope(): SellerScope {
  const scope = useContext(SellerScopeContext);
  if (!scope) {
    // A panel screen rendered outside the panel layout is a wiring mistake,
    // and a clear throw beats a screen full of undefined.
    throw new Error("useSellerScope must be used inside the seller panel layout");
  }
  return scope;
}

/** The id alone, which is all most hooks need. */
export function useSellerId(): string {
  return useSellerScope().seller.id;
}
