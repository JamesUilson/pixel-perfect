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

  /* --- uploads ------------------------------------------------------------
   * The API lists a person's files, not a store's, so the cache is keyed by
   * the uploader. Screens that want one store's files filter the same list.
   */
  myUploads: ["uploads", "mine"] as const,

  /* --- saved delivery addresses ------------------------------------------- */
  addresses: ["me", "addresses"] as const,

  /* --- the buyer's own balance ---------------------------------------------
   * Under "me" like everything else that belongs to the signed-in person, so
   * one predicate drops all of it when the session ends.
   */
  wallet: ["me", "wallet"] as const,
  walletCards: ["me", "wallet", "cards"] as const,
  walletTransactions: (page: number) => ["me", "wallet", "transactions", page] as const,

  /* --- admin: review queues, receipts, logs -------------------------------
   * Appended after the blocks above rather than merged into them: these keys
   * all begin with "admin", so the panel-wide invalidator (`qk.admin`) still
   * reaches every one of them.
   */
  adminStoreQueue: (status?: string | null) => ["admin", "stores", status ?? null] as const,
  adminStore: (sellerId: string) => ["admin", "store", sellerId] as const,
  adminUpload: (fileId: string) => ["admin", "upload", fileId] as const,

  adminPayoutQueue: (filters: Record<string, unknown>) =>
    ["admin", "payout-queue", filters] as const,

  adminReceipts: ["admin", "receipts"] as const,
  adminOrderReceipt: (orderId: string) => ["admin", "receipt", orderId] as const,

  adminHealth: ["admin", "health"] as const,
  adminRequestLogs: (filters: Record<string, unknown>) =>
    ["admin", "logs", "requests", filters] as const,
  adminRequestLog: (logId: string) => ["admin", "logs", "request", logId] as const,
  adminAuditLogs: (filters: Record<string, unknown>) =>
    ["admin", "logs", "audit", filters] as const,

  /* --- the feed studio: a store's clips and their numbers ------------------
   * Under "seller" like the rest of the panel, so switching store or saving a
   * clip drops the statistics with everything else that store owns. The window
   * is part of the key because the four chips are four different answers, not
   * four filters over one.
   */
  creatorStats: (sellerId: string, window: string) =>
    ["seller", sellerId, "feed-stats", window] as const,
  /** Page size is part of the key: the grid asks for twelve and the statistics
   * screen asks for one only to learn whether the store has ever posted. */
  sellerVideos: (sellerId: string, page: number, perPage: number) =>
    ["seller", sellerId, "videos", page, perPage] as const,
  sellerVideo: (sellerId: string, videoId: string) =>
    ["seller", sellerId, "video", videoId] as const,

  /** Begins with "admin", so `qk.admin` still clears it. */
  adminVideoQueue: (filters: Record<string, unknown>) =>
    ["admin", "videos", "pending", filters] as const,

  /* --- the account's own settings -----------------------------------------
   * Under "me" with the rest of the signed-in person's things, so the same
   * predicate that drops their cart and wallet on sign-out drops these too.
   */
  preferences: ["me", "preferences"] as const,
  sessions: ["me", "sessions"] as const,
  security: ["me", "security"] as const,

  /* --- the public feed -----------------------------------------------------
   * Every key here begins with "feed", so one predicate reaches the lot — and
   * it has to: a like lands on the same video in the scroller, in the detail
   * screen and in a creator's grid, and those are three cache entries.
   */
  feed: (filters: Record<string, unknown>) => ["feed", filters] as const,
  feedVideo: (videoId: string) => ["feed", "video", videoId] as const,
  feedComments: (videoId: string, sort: string) => ["feed", "comments", videoId, sort] as const,
  feedReplies: (commentId: string) => ["feed", "replies", commentId] as const,
  creator: (handle: string) => ["feed", "creator", handle] as const,
  creatorGrid: (handle: string, tab: string) => ["feed", "creator", handle, "grid", tab] as const,
} as const;
