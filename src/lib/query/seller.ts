/**
 * Everything the seller panel reads and writes.
 *
 * All of it is scoped by `sellerId`, which comes from the route. The server
 * checks membership on every call regardless, so the id in the URL is a
 * convenience and never the authorisation.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { safeApi } from "@/lib/api/client";
import type {
  BalanceOut,
  CampaignDayOut,
  CampaignIn,
  CampaignOut,
  CampaignStatusIn,
  CampaignUpdateIn,
  CategorySlice,
  CreativeIn,
  CreativeOut,
  LedgerEntryOut,
  MovementOut,
  MoneyFlowDay,
  OfferUpsertIn,
  PayoutOut,
  PayoutRequestIn,
  PlacementOut,
  PromotionIn,
  PromotionOut,
  ProductCreateIn,
  ProductUpdateIn,
  PromotionUpdateIn,
  RedemptionOut,
  SalesDay,
  SellerOfferRow,
  SellerOnboardIn,
  SellerOut,
  SellerOverview,
  StatusCount,
  StockAdjustIn,
  StockRowOut,
  StockSettingsIn,
  StockTransferIn,
  TopProduct,
  WarehouseIn,
  WarehouseOut,
  WarehouseStock,
  WarehouseSummaryOut,
  WarehouseUpdateIn,
} from "@/lib/api/types";
import { qk } from "./keys";
import { useIsAuthenticated } from "./session";

/** Invalidate everything under one store. Cheap, and never stale by accident. */
function useScopeInvalidator(sellerId: string) {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: qk.sellerScope(sellerId) });
}

/* --- stores ----------------------------------------------------------------- */
export function useMyStores() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.myStores,
    queryFn: () => safeApi<SellerOut[]>("/sellers/me"),
    enabled: signedIn,
  });
}

export function useOnboardSeller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SellerOnboardIn) =>
      safeApi<SellerOut>("/sellers/onboard", { method: "POST", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.myStores });
      void queryClient.invalidateQueries({ queryKey: qk.me });
    },
  });
}

/* --- dashboard -------------------------------------------------------------- */
export function useSellerOverview(sellerId: string, days = 30) {
  return useQuery({
    queryKey: qk.sellerOverview(sellerId, days),
    queryFn: () =>
      safeApi<SellerOverview>(`/seller/${sellerId}/analytics/overview`, { query: { days } }),
    enabled: Boolean(sellerId),
  });
}

export function useSellerSales(sellerId: string, days = 30) {
  return useQuery({
    queryKey: qk.sellerSales(sellerId, days),
    queryFn: () => safeApi<SalesDay[]>(`/seller/${sellerId}/analytics/sales`, { query: { days } }),
    enabled: Boolean(sellerId),
  });
}

export function useSellerMoneyFlow(sellerId: string, days = 30) {
  return useQuery({
    queryKey: qk.sellerMoneyFlow(sellerId, days),
    queryFn: () =>
      safeApi<MoneyFlowDay[]>(`/seller/${sellerId}/analytics/money-flow`, { query: { days } }),
    enabled: Boolean(sellerId),
  });
}

export function useSellerStatuses(sellerId: string) {
  return useQuery({
    queryKey: qk.sellerStatuses(sellerId),
    queryFn: () => safeApi<StatusCount[]>(`/seller/${sellerId}/analytics/orders-by-status`),
    enabled: Boolean(sellerId),
  });
}

export function useSellerTopProducts(sellerId: string, days = 30) {
  return useQuery({
    queryKey: qk.sellerTopProducts(sellerId, days),
    queryFn: () =>
      safeApi<TopProduct[]>(`/seller/${sellerId}/analytics/top-products`, { query: { days } }),
    enabled: Boolean(sellerId),
  });
}

export function useSellerCategories(sellerId: string, days = 90) {
  return useQuery({
    queryKey: qk.sellerCategories(sellerId, days),
    queryFn: () =>
      safeApi<CategorySlice[]>(`/seller/${sellerId}/analytics/categories`, { query: { days } }),
    enabled: Boolean(sellerId),
  });
}

export function useSellerStockChart(sellerId: string) {
  return useQuery({
    queryKey: qk.sellerStockChart(sellerId),
    queryFn: () => safeApi<WarehouseStock[]>(`/seller/${sellerId}/analytics/stock`),
    enabled: Boolean(sellerId),
  });
}

/* --- warehouses ------------------------------------------------------------- */
export function useWarehouses(sellerId: string) {
  return useQuery({
    queryKey: qk.warehouses(sellerId),
    queryFn: () => safeApi<WarehouseOut[]>(`/seller/${sellerId}/inventory/warehouses`),
    enabled: Boolean(sellerId),
  });
}

export function useWarehouseSummary(sellerId: string) {
  return useQuery({
    queryKey: qk.warehouseSummary(sellerId),
    queryFn: () =>
      safeApi<WarehouseSummaryOut[]>(`/seller/${sellerId}/inventory/warehouses/summary`),
    enabled: Boolean(sellerId),
  });
}

export function useCreateWarehouse(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (input: WarehouseIn) =>
      safeApi<WarehouseOut>(`/seller/${sellerId}/inventory/warehouses`, {
        method: "POST",
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateWarehouse(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: ({ warehouseId, ...body }: WarehouseUpdateIn & { warehouseId: string }) =>
      safeApi<WarehouseOut>(`/seller/${sellerId}/inventory/warehouses/${warehouseId}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: invalidate,
  });
}

export function useMakeDefaultWarehouse(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (warehouseId: string) =>
      safeApi<WarehouseOut>(`/seller/${sellerId}/inventory/warehouses/${warehouseId}/default`, {
        method: "POST",
      }),
    onSuccess: invalidate,
  });
}

/* --- stock ------------------------------------------------------------------- */
export function useStock(sellerId: string, warehouseId?: string | null) {
  return useQuery({
    queryKey: qk.stock(sellerId, warehouseId),
    queryFn: () =>
      safeApi<StockRowOut[]>(`/seller/${sellerId}/inventory/stock`, {
        query: { warehouse_id: warehouseId },
      }),
    enabled: Boolean(sellerId),
  });
}

export function useLowStock(sellerId: string) {
  return useQuery({
    queryKey: qk.lowStock(sellerId),
    queryFn: () => safeApi<StockRowOut[]>(`/seller/${sellerId}/inventory/stock/low`),
    enabled: Boolean(sellerId),
  });
}

export function useAdjustStock(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (input: StockAdjustIn) =>
      safeApi<StockRowOut>(`/seller/${sellerId}/inventory/stock/adjust`, {
        method: "POST",
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useTransferStock(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (input: StockTransferIn) =>
      safeApi<StockRowOut[]>(`/seller/${sellerId}/inventory/stock/transfer`, {
        method: "POST",
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useStockSettings(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (input: StockSettingsIn) =>
      safeApi<StockRowOut>(`/seller/${sellerId}/inventory/stock/settings`, {
        method: "POST",
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useMovements(
  sellerId: string,
  filters: { warehouse_id?: string | null; kind?: string | null; limit?: number } = {},
) {
  return useQuery({
    queryKey: qk.movements(sellerId, filters),
    queryFn: () =>
      safeApi<MovementOut[]>(`/seller/${sellerId}/inventory/movements`, { query: filters }),
    enabled: Boolean(sellerId),
  });
}

/* --- money -------------------------------------------------------------------- */
export function useBalance(sellerId: string) {
  return useQuery({
    queryKey: qk.balance(sellerId),
    queryFn: () => safeApi<BalanceOut>(`/seller/${sellerId}/finance/balance`),
    enabled: Boolean(sellerId),
  });
}

export function useLedger(
  sellerId: string,
  filters: { account?: string | null; kind?: string | null; limit?: number } = {},
) {
  return useQuery({
    queryKey: qk.ledger(sellerId, filters),
    queryFn: () =>
      safeApi<LedgerEntryOut[]>(`/seller/${sellerId}/finance/ledger`, { query: filters }),
    enabled: Boolean(sellerId),
  });
}

export function usePayouts(sellerId: string) {
  return useQuery({
    queryKey: qk.payouts(sellerId),
    queryFn: () => safeApi<PayoutOut[]>(`/seller/${sellerId}/finance/payouts`),
    enabled: Boolean(sellerId),
  });
}

export function useRequestPayout(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (input: PayoutRequestIn) =>
      safeApi<PayoutOut>(`/seller/${sellerId}/finance/payouts`, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

/* --- promotions ---------------------------------------------------------------- */
export function usePromotions(sellerId: string) {
  return useQuery({
    queryKey: qk.promotions(sellerId),
    queryFn: () => safeApi<PromotionOut[]>(`/seller/${sellerId}/promotions`),
    enabled: Boolean(sellerId),
  });
}

export function useCreatePromotion(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (input: PromotionIn) =>
      safeApi<PromotionOut>(`/seller/${sellerId}/promotions`, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdatePromotion(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: ({ promotionId, ...body }: PromotionUpdateIn & { promotionId: string }) =>
      safeApi<PromotionOut>(`/seller/${sellerId}/promotions/${promotionId}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: invalidate,
  });
}

export function useTogglePromotion(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: ({ promotionId, active }: { promotionId: string; active: boolean }) =>
      safeApi<PromotionOut>(
        `/seller/${sellerId}/promotions/${promotionId}/${active ? "resume" : "pause"}`,
        { method: "POST" },
      ),
    onSuccess: invalidate,
  });
}

export function usePromotionRedemptions(sellerId: string, promotionId: string | null) {
  return useQuery({
    queryKey: ["seller", sellerId, "promotion", promotionId, "redemptions"],
    queryFn: () =>
      safeApi<RedemptionOut[]>(`/seller/${sellerId}/promotions/${promotionId}/redemptions`),
    enabled: Boolean(sellerId && promotionId),
  });
}

/* --- advertising ---------------------------------------------------------------- */
export function usePlacements() {
  return useQuery({
    queryKey: ["ads", "placements"],
    queryFn: () => safeApi<PlacementOut[]>("/ads/placements"),
    staleTime: 5 * 60_000,
  });
}

export function useCampaigns(sellerId: string) {
  return useQuery({
    queryKey: qk.campaigns(sellerId),
    queryFn: () => safeApi<CampaignOut[]>(`/seller/${sellerId}/ads/campaigns`),
    enabled: Boolean(sellerId),
  });
}

export function useCampaignDaily(sellerId: string, campaignId: string | null, days = 30) {
  return useQuery({
    queryKey: qk.campaignDaily(sellerId, campaignId ?? "", days),
    queryFn: () =>
      safeApi<CampaignDayOut[]>(`/seller/${sellerId}/ads/campaigns/${campaignId}/daily`, {
        query: { days },
      }),
    enabled: Boolean(sellerId && campaignId),
  });
}

export function useCreateCampaign(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (input: CampaignIn) =>
      safeApi<CampaignOut>(`/seller/${sellerId}/ads/campaigns`, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateCampaign(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: ({ campaignId, ...body }: CampaignUpdateIn & { campaignId: string }) =>
      safeApi<CampaignOut>(`/seller/${sellerId}/ads/campaigns/${campaignId}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: invalidate,
  });
}

export function useCampaignStatus(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: ({ campaignId, ...body }: CampaignStatusIn & { campaignId: string }) =>
      safeApi<CampaignOut>(`/seller/${sellerId}/ads/campaigns/${campaignId}/status`, {
        method: "POST",
        body,
      }),
    onSuccess: invalidate,
  });
}

export function useAddCreative(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: ({ campaignId, ...body }: CreativeIn & { campaignId: string }) =>
      safeApi<CreativeOut>(`/seller/${sellerId}/ads/campaigns/${campaignId}/creatives`, {
        method: "POST",
        body,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteCreative(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (creativeId: string) =>
      safeApi<void>(`/seller/${sellerId}/ads/creatives/${creativeId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

/* --- catalogue ------------------------------------------------------------------ */
export function useSellerOffers(sellerId: string) {
  return useQuery({
    queryKey: qk.sellerOffers(sellerId),
    queryFn: () => safeApi<SellerOfferRow[]>(`/seller/${sellerId}/offers`),
    enabled: Boolean(sellerId),
  });
}

export function useUpsertOffer(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (input: OfferUpsertIn) =>
      safeApi<{ id: string; price: string; stock: number; status: string }>(
        `/seller/${sellerId}/offers`,
        { method: "PUT", body: input },
      ),
    onSuccess: invalidate,
  });
}

export function useCreateProduct(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (input: ProductCreateIn) =>
      safeApi<{ id: string; slug: string; status: string }>(`/seller/${sellerId}/products`, {
        method: "POST",
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateProduct(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: ({ productId, ...body }: ProductUpdateIn & { productId: string }) =>
      safeApi<{ id: string; slug: string }>(`/seller/products/${productId}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: invalidate,
  });
}

/* --- orders ---------------------------------------------------------------------- */
export type SellerOrderRow = {
  id: string;
  order_number: string;
  status: string;
  subtotal: string;
  delivery_fee: string;
  created_at: string;
  items: { product_name: string; quantity: number; unit_price: string }[];
};

export function useSellerOrders(sellerId: string) {
  return useQuery({
    queryKey: qk.sellerOrders(sellerId),
    queryFn: () => safeApi<SellerOrderRow[]>(`/seller/${sellerId}/orders`),
    enabled: Boolean(sellerId),
  });
}

export function useChangeOrderStatus(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: ({
      orderId,
      status,
      note,
    }: {
      orderId: string;
      status: string;
      note?: string | undefined;
    }) =>
      safeApi<unknown>(`/seller/${sellerId}/orders/${orderId}/status`, {
        method: "POST",
        body: { status, note },
      }),
    onSuccess: invalidate,
  });
}
