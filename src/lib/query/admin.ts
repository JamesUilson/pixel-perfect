/**
 * Everything the super-admin panel reads and writes.
 *
 * Read access is staff-wide; the writes that move money or change what the
 * marketplace charges are SUPER_ADMIN only, and the server enforces that — a
 * button hidden in the UI is a courtesy, not a control.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { safeApi } from "@/lib/api/client";
import type {
  AccountTotalOut,
  ActiveGatewaysOut,
  AdDay,
  BannerIn,
  BannerOut,
  BannerUpdateIn,
  CampaignOut,
  CategorySlice,
  CommissionRuleIn,
  CommissionRuleOut,
  GmvDay,
  InventoryHealth,
  LedgerEntryOut,
  LedgerIntegrity,
  Page,
  PaymentGateway,
  PaymentSettingIn,
  PaymentSettingOut,
  PayoutOut,
  PlacementIn,
  PlacementOut,
  PlatformOverview,
  PromotionOut,
  SellerOut,
  StatusCount,
  TopSeller,
  UserGrowthDay,
} from "@/lib/api/types";
import { qk } from "./keys";
import { useIsAuthenticated } from "./session";

function useAdminInvalidator() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: qk.admin });
}

/* --- dashboard ----------------------------------------------------------------- */
export function usePlatformOverview(days = 30) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminOverview(days),
    queryFn: () => safeApi<PlatformOverview>("/admin/analytics/overview", { query: { days } }),
    enabled: signedIn,
  });
}

export function usePlatformGmv(days = 30) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminGmv(days),
    queryFn: () => safeApi<GmvDay[]>("/admin/analytics/gmv", { query: { days } }),
    enabled: signedIn,
  });
}

export function useTopSellers(days = 30, limit = 10) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminTopSellers(days),
    queryFn: () => safeApi<TopSeller[]>("/admin/analytics/top-sellers", { query: { days, limit } }),
    enabled: signedIn,
  });
}

export function usePlatformStatuses() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminStatuses,
    queryFn: () => safeApi<StatusCount[]>("/admin/analytics/orders-by-status"),
    enabled: signedIn,
  });
}

export function usePlatformCategories(days = 90) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminCategories(days),
    queryFn: () => safeApi<CategorySlice[]>("/admin/analytics/categories", { query: { days } }),
    enabled: signedIn,
  });
}

export function usePlatformUsers(days = 30) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminUsers(days),
    queryFn: () => safeApi<UserGrowthDay[]>("/admin/analytics/users", { query: { days } }),
    enabled: signedIn,
  });
}

export function usePlatformAds(days = 30) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminAds(days),
    queryFn: () => safeApi<AdDay[]>("/admin/analytics/ads", { query: { days } }),
    enabled: signedIn,
  });
}

export function usePlatformInventory() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminInventory,
    queryFn: () => safeApi<InventoryHealth>("/admin/analytics/inventory"),
    enabled: signedIn,
  });
}

/* --- money --------------------------------------------------------------------- */
export function usePlatformBalances() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminSummary,
    queryFn: () => safeApi<AccountTotalOut[]>("/admin/finance/summary"),
    enabled: signedIn,
  });
}

export function useAdminLedger(
  filters: { seller_id?: string | null; account?: string | null; limit?: number } = {},
) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminLedger(filters),
    queryFn: () => safeApi<LedgerEntryOut[]>("/admin/finance/ledger", { query: filters }),
    enabled: signedIn,
  });
}

/** Should always report balanced. The screen exists so that is checkable. */
export function useLedgerIntegrity() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminIntegrity,
    queryFn: () => safeApi<LedgerIntegrity>("/admin/finance/integrity"),
    enabled: signedIn,
  });
}

export function useAdminPayouts() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminPayouts,
    queryFn: () => safeApi<PayoutOut[]>("/admin/finance/payouts"),
    enabled: signedIn,
  });
}

export function useDecidePayout() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: ({
      payoutId,
      status,
      note,
    }: {
      payoutId: string;
      status: string;
      note?: string | undefined;
    }) =>
      safeApi<PayoutOut>(`/admin/finance/payouts/${payoutId}/decision`, {
        method: "POST",
        body: { status, note },
      }),
    onSuccess: invalidate,
  });
}

export function useCommissionRules() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminCommissionRules,
    queryFn: () => safeApi<CommissionRuleOut[]>("/admin/finance/commission-rules"),
    enabled: signedIn,
  });
}

export function useCreateCommissionRule() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: (input: CommissionRuleIn) =>
      safeApi<CommissionRuleOut>("/admin/finance/commission-rules", {
        method: "POST",
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteCommissionRule() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: (ruleId: string) =>
      safeApi<CommissionRuleOut>(`/admin/finance/commission-rules/${ruleId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });
}

/* --- payment gateways -------------------------------------------------------------
 * A gateway's secret never comes back from the server; the list carries a
 * masked hint instead, and an empty secret field on save means "keep it".
 */
export function usePaymentSettings() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminPaymentSettings,
    queryFn: () => safeApi<PaymentSettingOut[]>("/admin/payments/settings"),
    enabled: signedIn,
  });
}

export function useActiveGateways() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminPaymentActive,
    queryFn: () => safeApi<ActiveGatewaysOut>("/admin/payments/active"),
    enabled: signedIn,
  });
}

export function useSavePaymentSetting() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: ({ gateway, ...body }: PaymentSettingIn & { gateway: PaymentGateway }) =>
      safeApi<PaymentSettingOut>(`/admin/payments/settings/${gateway}`, {
        method: "PUT",
        body,
      }),
    onSuccess: invalidate,
  });
}

/* --- advertising ---------------------------------------------------------------- */
export function useAdminCampaigns(status?: string | null) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminCampaigns(status),
    queryFn: () => safeApi<CampaignOut[]>("/admin/ads/campaigns", { query: { status } }),
    enabled: signedIn,
  });
}

export function useModerateCampaign() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: ({
      campaignId,
      status,
      reason,
    }: {
      campaignId: string;
      status: string;
      reason?: string | undefined;
    }) =>
      safeApi<CampaignOut>(`/admin/ads/campaigns/${campaignId}/moderate`, {
        method: "POST",
        body: { status, reason },
      }),
    onSuccess: invalidate,
  });
}

export function useAdminPlacements() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminPlacements,
    queryFn: () => safeApi<PlacementOut[]>("/admin/ads/placements"),
    enabled: signedIn,
  });
}

export function useSavePlacement() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: (input: PlacementIn) =>
      safeApi<PlacementOut>("/admin/ads/placements", { method: "PUT", body: input }),
    onSuccess: invalidate,
  });
}

export function useAdminBanners() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminBanners,
    queryFn: () => safeApi<BannerOut[]>("/admin/ads/banners"),
    enabled: signedIn,
  });
}

export function useCreateBanner() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: (input: BannerIn) =>
      safeApi<BannerOut>("/admin/ads/banners", { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateBanner() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: ({ bannerId, ...body }: BannerUpdateIn & { bannerId: string }) =>
      safeApi<BannerOut>(`/admin/ads/banners/${bannerId}`, { method: "PATCH", body }),
    onSuccess: invalidate,
  });
}

export function useDeleteBanner() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: (bannerId: string) =>
      safeApi<void>(`/admin/ads/banners/${bannerId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

/* --- sellers and promotions ------------------------------------------------------ */
export function useAdminSellers() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminSellers,
    queryFn: () => safeApi<SellerOut[]>("/sellers"),
    enabled: signedIn,
  });
}

export function useAdminPromotions() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminPromotions,
    queryFn: () => safeApi<PromotionOut[]>("/admin/promotions"),
    enabled: signedIn,
  });
}

/* ================================================================================
 * Store review, payout approval, receipts, logs and health.
 *
 * The payload types below are written out by hand rather than pulled from
 * `lib/api/types.ts`. The checked-in `schema.d.ts` predates these endpoints, so
 * there is nothing to alias yet; spelling them here keeps the screens typed
 * today and leaves one obvious place to delete once the schema is regenerated.
 * ============================================================================== */

/* --- store review ---------------------------------------------------------------- */
export type StoreDocumentOut = {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

export type StoreVerificationOut = {
  id: string;
  requested_level: string;
  legal_name: string | null;
  registration_number: string | null;
  document_urls: unknown[] | null;
  approved: boolean | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type StoreReviewOut = {
  id: string;
  slug: string;
  store_name: string;
  status: string;
  verification_level: string;
  region: string;
  district: string;
  address: string | null;
  phone: string | null;
  created_at: string;
  status_reason: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
  owner_id: string;
  owner_name: string | null;
  owner_phone: string | null;
  verifications: StoreVerificationOut[];
  documents: StoreDocumentOut[];
  active_offer_count: number;
};

/** The four moves the server allows. Anything else is refused with a 409. */
export type StoreMove = "approve" | "reject" | "suspend" | "reinstate";

export function useStoreQueue(status?: string | null) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminStoreQueue(status),
    queryFn: () => safeApi<StoreReviewOut[]>("/admin/stores", { query: { status, limit: 200 } }),
    enabled: signedIn,
  });
}

/**
 * One store with its dossier re-read from the server.
 *
 * The list already carries the evidence, but a decision returns the fresh row
 * and a reviewer may sit on the dialog while someone else acts, so the open
 * dossier reads its own copy.
 */
export function useStoreDossier(sellerId: string | null) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminStore(sellerId ?? ""),
    queryFn: () => safeApi<StoreReviewOut>(`/admin/stores/${sellerId ?? ""}`),
    enabled: signedIn && sellerId !== null,
  });
}

export function useDecideStore() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: ({
      sellerId,
      move,
      reason,
    }: {
      sellerId: string;
      move: StoreMove;
      reason?: string | undefined;
    }) =>
      safeApi<StoreReviewOut>(`/admin/stores/${sellerId}/${move}`, {
        method: "POST",
        body: { reason: reason ?? null },
      }),
    onSuccess: invalidate,
  });
}

/* --- private seller documents ------------------------------------------------------
 * The review payload deliberately carries a document's name and size but not
 * its location: seller papers are fetched through `/uploads/{id}`, which checks
 * who is asking, rather than handed out behind a guessable link.
 */
export type UploadOut = {
  id: string;
  purpose: string;
  seller_id: string | null;
  original_filename: string;
  url: string;
  thumbnail_url: string | null;
  content_type: string;
  size_bytes: number;
  checksum: string;
  is_private: boolean;
  created_at: string;
};

export function useUploadDetail(fileId: string | null) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminUpload(fileId ?? ""),
    queryFn: () => safeApi<UploadOut>(`/uploads/${fileId ?? ""}`),
    enabled: signedIn && fileId !== null,
  });
}

/* --- payout approval ---------------------------------------------------------------- */
/**
 * A saved destination as the operator sees it. Every field here is for
 * recognising the card; none of them can charge it, and there is no field that
 * could carry a card number.
 */
export type PayoutDestinationOut = {
  id: string;
  kind: string;
  status: string;
  brand: string;
  last4: string | null;
  holder_name: string | null;
  bank_name: string | null;
  expires_month: number | null;
  expires_year: number | null;
  account_label: string | null;
  is_default: boolean;
  verified_at: string | null;
  created_at: string;
  /** "Kapitalbank ••••4417" — already masked by the server. */
  display: string;
  is_payable: boolean;
};

export type PayoutRequestOut = PayoutOut & {
  store_name: string;
  destination: PayoutDestinationOut | null;
  destination_verified: boolean;
};

export function usePayoutQueue(
  filters: { status?: string | null; seller_id?: string | null } = {},
) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminPayoutQueue(filters),
    queryFn: () => safeApi<PayoutRequestOut[]>("/admin/finance/payouts", { query: filters }),
    enabled: signedIn,
  });
}

/**
 * Books the transfer and marks the request paid.
 *
 * Idempotent on the server: a payout that is already PAID comes back unchanged
 * rather than being booked twice, so a double click costs nothing.
 */
export function useApprovePayout() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: ({ payoutId, note }: { payoutId: string; note?: string | undefined }) =>
      safeApi<PayoutOut>(`/admin/finance/payouts/${payoutId}/approve`, {
        method: "POST",
        body: { note: note ?? null },
      }),
    onSuccess: invalidate,
  });
}

/** Releases the hold, so the amount is withdrawable again. Also idempotent. */
export function useRejectPayout() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: ({ payoutId, reason }: { payoutId: string; reason: string }) =>
      safeApi<PayoutOut>(`/admin/finance/payouts/${payoutId}/reject`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: invalidate,
  });
}

/* --- receipts ----------------------------------------------------------------------- */
export type ReceiptLine = {
  name: string;
  oem_number: string | null;
  quantity: number;
  unit_price: string;
  discount: string;
  line_total: string;
};

export type ReceiptSellerBlock = {
  order_seller_id: string;
  seller_id: string;
  store_name: string;
  region: string | null;
  district: string | null;
  phone: string | null;
  delivery_method: string;
  lines: ReceiptLine[];
  subtotal: string;
  discount: string;
  delivery_fee: string;
  total: string;
};

export type ReceiptSnapshot = {
  order?: {
    id?: string;
    number?: string;
    currency?: string;
    payment_method?: string;
    promo_code?: string | null;
    placed_at?: string;
  };
  buyer?: {
    user_id?: string;
    name?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  sellers?: ReceiptSellerBlock[];
  totals?: {
    subtotal?: string;
    discount_total?: string;
    delivery_total?: string;
    grand_total?: string;
  };
};

export type ReceiptOut = {
  id: string;
  number: string;
  order_id: string;
  issued_at: string;
  currency: string;
  subtotal: string;
  discount_total: string;
  delivery_total: string;
  grand_total: string;
  document_url: string | null;
  document_format: string;
  snapshot: ReceiptSnapshot;
};

export function useAdminReceipts(limit = 100) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminReceipts,
    queryFn: () => safeApi<ReceiptOut[]>("/admin/receipts", { query: { limit } }),
    enabled: signedIn,
  });
}

export function useOrderReceipt(orderId: string | null) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminOrderReceipt(orderId ?? ""),
    queryFn: () => safeApi<ReceiptOut>(`/admin/receipts/orders/${orderId ?? ""}`),
    enabled: signedIn && orderId !== null,
    // A missing receipt is the normal answer for an order nobody has issued
    // one for; retrying a 404 only delays the empty state.
    retry: false,
  });
}

/**
 * Issue the order's receipt, or return the one it already has.
 *
 * Never a regeneration: the server answers 201 the first time and 200
 * afterwards, with the same number and the same frozen figures.
 */
export function useIssueReceipt() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: (orderId: string) =>
      safeApi<ReceiptOut>(`/admin/receipts/orders/${orderId}`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

/* --- system health -------------------------------------------------------------------
 * Every probe is wrapped on the server, so a broken check reports itself as
 * broken and the rest of the payload still arrives. The optional fields below
 * are optional for that reason, not out of caution.
 */
export type SystemHealth = {
  status: string;
  checked_at: string;
  app: {
    name: string;
    version: string;
    env: string;
    debug: boolean;
    locale: string;
    sms_provider: string;
    payment_provider_default: string;
    rate_limit_enabled: boolean;
    verified_contact_required: boolean;
  };
  database: { status: string; latency_ms?: number; backend?: string; error?: string };
  migrations: {
    status: string;
    current?: string | null;
    head?: string | null;
    pending?: boolean;
    error?: string;
  };
  redis: { status: string; latency_ms?: number; error?: string; impact?: string };
  storage: {
    status: string;
    backend: string;
    path?: string;
    writable?: boolean;
    bucket?: string | null;
    endpoint?: string | null;
    public_base_url?: string | null;
  };
  queues: {
    pending_stores?: number;
    pending_payouts?: number;
    failed_payments_24h?: number;
    error?: string;
  };
  traffic: {
    window_hours?: number;
    by_status_class?: Record<string, number>;
    slowest_ms?: number;
    top_errors?: { code: string; count: number }[];
    request_log_rows?: number;
    audit_log_rows?: number;
    sample_rate?: number;
    retention_days?: number;
  };
};

export function useSystemHealth() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminHealth,
    queryFn: () => safeApi<SystemHealth>("/admin/system/health"),
    enabled: signedIn,
    // The page is read while something is on fire; a minute-old answer is not
    // good enough, but hammering the probes is not either.
    refetchInterval: 30_000,
  });
}

/* --- request and audit logs ----------------------------------------------------------- */
export type RequestLogRow = {
  id: string;
  occurred_at: string;
  method: string;
  path: string;
  route: string | null;
  status_code: number;
  status_class: string;
  duration_ms: number;
  actor_id: string | null;
  ip_address: string | null;
  error_code: string | null;
  request_id: string | null;
};

export type RequestLogDetail = RequestLogRow & {
  query: string | null;
  user_agent: string | null;
  error_message: string | null;
  traceback: string | null;
};

export type AuditLogRow = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  actor_roles: string | null;
  ip_address: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export type RequestLogFilters = {
  status_class?: string | null;
  status_code?: number | null;
  method?: string | null;
  path_prefix?: string | null;
  actor_id?: string | null;
  error_code?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  page?: number;
  size?: number;
};

export type AuditLogFilters = {
  action?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  actor_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  page?: number;
  size?: number;
};

export function useRequestLogs(filters: RequestLogFilters) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminRequestLogs(filters),
    queryFn: () => safeApi<Page<RequestLogRow>>("/admin/logs/requests", { query: filters }),
    enabled: signedIn,
    // Paging a log should not blank the table between pages.
    placeholderData: (previous) => previous,
  });
}

export function useRequestLogDetail(logId: string | null) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminRequestLog(logId ?? ""),
    queryFn: () => safeApi<RequestLogDetail>(`/admin/logs/requests/${logId ?? ""}`),
    enabled: signedIn && logId !== null,
  });
}

export function useAuditLogs(filters: AuditLogFilters) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminAuditLogs(filters),
    queryFn: () => safeApi<Page<AuditLogRow>>("/admin/logs/audit", { query: filters }),
    enabled: signedIn,
    placeholderData: (previous) => previous,
  });
}

/** Retention by hand. SUPER_ADMIN only — the server answers 403 to anyone else. */
export function usePurgeRequestLogs() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: (olderThanDays?: number | undefined) =>
      safeApi<{ deleted: number; older_than_days: number }>("/admin/logs/requests", {
        method: "DELETE",
        query: { older_than_days: olderThanDays ?? null },
      }),
    onSuccess: invalidate,
  });
}

/* --- video moderation -----------------------------------------------------------
 * The queue the feed waits on. Shapes written by hand from
 * `app/modules/videos/router.py`, which answers with a plain dict; the
 * generated schema does not describe the videos module yet.
 */
export type PendingVideoRow = {
  id: string;
  seller_id: string | null;
  store_name: string | null;
  handle: string | null;
  caption: string | null;
  hashtags: string[];
  region: string | null;
  playback_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  status: string;
  moderation_status: string;
  published_at: string | null;
  created_at: string;
  /** The seller has already pressed publish: only this decision is missing. */
  waiting_in_feed: boolean;
};

export type PendingVideoQueue = {
  total: number;
  limit: number;
  offset: number;
  items: PendingVideoRow[];
};

export function useAdminPendingVideos(limit = 50, offset = 0) {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.adminVideoQueue({ limit, offset }),
    queryFn: () =>
      safeApi<PendingVideoQueue>("/admin/videos/pending", { query: { limit, offset } }),
    enabled: signedIn,
  });
}

/**
 * Approve, or reject with a reason the server insists on.
 *
 * The reason is written to the audit log and nowhere else, so the seller reads
 * only that their clip was rejected. That is a backend gap, not something to
 * paper over here with a field the API does not have.
 */
export function useModerateVideo() {
  const invalidate = useAdminInvalidator();
  return useMutation({
    mutationFn: ({
      videoId,
      approved,
      reason,
    }: {
      videoId: string;
      approved: boolean;
      reason?: string | undefined;
    }) =>
      safeApi<unknown>(`/admin/videos/${videoId}/moderate`, {
        method: "POST",
        body: { approved, reason },
      }),
    onSuccess: invalidate,
  });
}
