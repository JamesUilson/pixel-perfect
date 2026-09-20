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
