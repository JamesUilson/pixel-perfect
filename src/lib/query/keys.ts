/** Every cache key in one place, so invalidation is never a guess. */
export const qk = {
  me: ["me"] as const,

  vehicleBrands: ["vehicles", "brands"] as const,
  vehicleModels: (brandSlug: string) => ["vehicles", "models", brandSlug] as const,
  vehicleVariants: (modelId: string, year?: number) =>
    ["vehicles", "variants", modelId, year ?? null] as const,
  vehicleYears: (modelId: string) => ["vehicles", "years", modelId] as const,

  garage: ["garage"] as const,

  categories: ["catalog", "categories"] as const,
  partBrands: ["catalog", "brands"] as const,

  products: (params: Record<string, unknown>) => ["products", params] as const,
  product: (slug: string, variantId?: string | null) =>
    ["product", slug, variantId ?? null] as const,
  suggest: (q: string) => ["suggest", q] as const,

  sellers: (filters: Record<string, unknown>) => ["sellers", filters] as const,
  seller: (slug: string) => ["seller", slug] as const,

  cart: ["cart"] as const,
  orders: ["orders"] as const,
  order: (id: string) => ["order", id] as const,
} as const;
