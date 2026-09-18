import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { safeApi } from "@/lib/api/client";
import type {
  CategoryOut,
  Page,
  PartBrandOut,
  ProductDetail,
  ProductListItem,
  SellerOut,
} from "@/lib/api/types";
import { qk } from "./keys";

export type ProductFilters = {
  q?: string | undefined;
  category?: string | undefined;
  brand?: string[] | undefined;
  price_min?: number | undefined;
  price_max?: number | undefined;
  rating_min?: number | undefined;
  in_stock?: boolean | undefined;
  fits_my_car?: boolean | undefined;
  sort?: string | undefined;
  page?: number | undefined;
  size?: number | undefined;
};

/**
 * Query options are declared separately from the hooks so a route `loader` can
 * prefetch exactly the same cache entry the component will read. That is what
 * makes the server-rendered HTML contain real content instead of a skeleton —
 * which is what search engines index.
 */
export const categoriesQuery = () =>
  queryOptions({
    queryKey: qk.categories,
    queryFn: () => safeApi<CategoryOut[]>("/catalog/categories"),
    // The category tree changes about as often as the business does.
    staleTime: 30 * 60_000,
  });

export const productsQuery = (filters: ProductFilters) =>
  queryOptions({
    queryKey: qk.products(filters),
    queryFn: () => safeApi<Page<ProductListItem>>("/products", { query: filters }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

export const productQuery = (slug: string, variantId?: string | null) =>
  queryOptions({
    queryKey: qk.product(slug, variantId),
    queryFn: () =>
      safeApi<ProductDetail>(`/products/${slug}`, {
        query: variantId ? { variant_id: variantId } : undefined,
      }),
    staleTime: 60_000,
  });

export function useCategories() {
  return useQuery(categoriesQuery());
}

export function usePartBrands() {
  return useQuery({
    queryKey: qk.partBrands,
    queryFn: () => safeApi<PartBrandOut[]>("/catalog/brands"),
    staleTime: 30 * 60_000,
  });
}

export function useProducts(filters: ProductFilters) {
  // keepPreviousData: the grid stays on screen while a filter change loads, so
  // the page never collapses to a spinner mid-browse.
  return useQuery(productsQuery(filters));
}

export function useProduct(slug: string, variantId?: string | null) {
  return useQuery(productQuery(slug, variantId));
}

export function useSellers(filters: { region?: string; district?: string } = {}) {
  return useQuery({
    queryKey: qk.sellers(filters),
    queryFn: () => safeApi<SellerOut[]>("/sellers", { query: filters }),
    staleTime: 10 * 60_000,
  });
}
