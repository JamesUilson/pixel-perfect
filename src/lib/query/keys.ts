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

  cart: (promoCode?: string | null) => ["cart", promoCode ?? null] as const,
  orders: ["orders"] as const,
  order: (id: string) => ["order", id] as const,

  /* --- seller panel ------------------------------------------------------ */
  myStores: ["seller", "mine"] as const,
  sellerScope: (sellerId: string) => ["seller", sellerId] as const,
  sellerOverview: (sellerId: string, days: number) =>
    ["seller", sellerId, "overview", days] as const,
  sellerSales: (sellerId: string, days: number) => ["seller", sellerId, "sales", days] as const,
  sellerMoneyFlow: (sellerId: string, days: number) =>
    ["seller", sellerId, "money-flow", days] as const,
  sellerStatuses: (sellerId: string) => ["seller", sellerId, "statuses"] as const,
  sellerTopProducts: (sellerId: string, days: number) =>
    ["seller", sellerId, "top-products", days] as const,
  sellerCategories: (sellerId: string, days: number) =>
    ["seller", sellerId, "categories", days] as const,
  sellerStockChart: (sellerId: string) => ["seller", sellerId, "stock-chart"] as const,

  warehouses: (sellerId: string) => ["seller", sellerId, "warehouses"] as const,
  warehouseSummary: (sellerId: string) => ["seller", sellerId, "warehouse-summary"] as const,
  stock: (sellerId: string, warehouseId?: string | null) =>
    ["seller", sellerId, "stock", warehouseId ?? null] as const,
  lowStock: (sellerId: string) => ["seller", sellerId, "low-stock"] as const,
  movements: (sellerId: string, filters: Record<string, unknown>) =>
    ["seller", sellerId, "movements", filters] as const,

  balance: (sellerId: string) => ["seller", sellerId, "balance"] as const,
  ledger: (sellerId: string, filters: Record<string, unknown>) =>
    ["seller", sellerId, "ledger", filters] as const,
  payouts: (sellerId: string) => ["seller", sellerId, "payouts"] as const,
  payoutMethods: (sellerId: string) => ["seller", sellerId, "payout-methods"] as const,

  promotions: (sellerId: string) => ["seller", sellerId, "promotions"] as const,
  campaigns: (sellerId: string) => ["seller", sellerId, "campaigns"] as const,
  campaign: (sellerId: string, campaignId: string) =>
    ["seller", sellerId, "campaign", campaignId] as const,
  campaignDaily: (sellerId: string, campaignId: string, days: number) =>
    ["seller", sellerId, "campaign", campaignId, "daily", days] as const,
  sellerOrders: (sellerId: string) => ["seller", sellerId, "orders"] as const,
  sellerOffers: (sellerId: string) => ["seller", sellerId, "offers"] as const,

  /* --- admin ------------------------------------------------------------- */
  admin: ["admin"] as const,
  adminOverview: (days: number) => ["admin", "overview", days] as const,
  adminGmv: (days: number) => ["admin", "gmv", days] as const,
  adminTopSellers: (days: number) => ["admin", "top-sellers", days] as const,
  adminStatuses: ["admin", "statuses"] as const,
  adminCategories: (days: number) => ["admin", "categories", days] as const,
  adminUsers: (days: number) => ["admin", "users", days] as const,
  adminAds: (days: number) => ["admin", "ads", days] as const,
  adminInventory: ["admin", "inventory"] as const,
  adminLedger: (filters: Record<string, unknown>) => ["admin", "ledger", filters] as const,
  adminSummary: ["admin", "summary"] as const,
  adminIntegrity: ["admin", "integrity"] as const,
  adminPayouts: ["admin", "payouts"] as const,
  adminCommissionRules: ["admin", "commission-rules"] as const,
  adminCampaigns: (status?: string | null) => ["admin", "campaigns", status ?? null] as const,
  adminPlacements: ["admin", "placements"] as const,
  adminBanners: ["admin", "banners"] as const,
  adminSellers: ["admin", "sellers"] as const,
  adminPromotions: ["admin", "promotions"] as const,
  adminPaymentSettings: ["admin", "payment-settings"] as const,
  adminPaymentActive: ["admin", "payment-active"] as const,

  /* --- storefront -------------------------------------------------------- */
  adSlot: (slot: string, params: Record<string, unknown>) => ["ads", slot, params] as const,
  purchaseSummary: ["me", "purchase-summary"] as const,
} as const;
