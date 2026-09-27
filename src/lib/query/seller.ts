/**
 * Everything the seller panel reads and writes.
 *
 * All of it is scoped by `sellerId`, which comes from the route. The server
 * checks membership on every call regardless, so the id in the URL is a
 * convenience and never the authorisation.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, safeApi, tokens } from "@/lib/api/client";
import type {
  ApiErrorBody,
  BalanceOut,
  CampaignDayOut,
  CampaignIn,
  CampaignOut,
  CampaignStatusIn,
  CampaignUpdateIn,
  CardAddedOut,
  CardCodeResent,
  CardIn,
  CategorySlice,
  CreativeIn,
  CreativeOut,
  LedgerEntryOut,
  MovementOut,
  MoneyFlowDay,
  OfferUpsertIn,
  PayoutMethodOut,
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
  SellerUpdateIn,
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

/* --- shapes the generated schema does not carry yet ---------------------------
 * `schema.d.ts` is regenerated from the API's OpenAPI document and is behind on
 * the map point, the two extra store images and the whole uploads module. These
 * aliases widen the generated types with exactly the fields the server sends, so
 * a regeneration makes them redundant rather than wrong.
 */

/** A store as `/sellers/me` returns it, map links and all. */
export type SellerStore = SellerOut & {
  icon_url?: string | null;
  banner_url?: string | null;
  /** Decimal, serialised as a string so no precision is lost on the way here. */
  latitude?: string | null;
  longitude?: string | null;
  /** Built by the server — the client never assembles a Yandex URL itself. */
  map_url?: string | null;
  navigator_url?: string | null;
};

export type StoreOnboardIn = SellerOnboardIn & {
  latitude?: string | null;
  longitude?: string | null;
};

export type StoreUpdateIn = SellerUpdateIn & {
  store_name?: string | null;
  region?: string | null;
  district?: string | null;
  icon_url?: string | null;
  banner_url?: string | null;
  latitude?: string | null;
  longitude?: string | null;
};

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
    queryFn: () => safeApi<SellerStore[]>("/sellers/me"),
    enabled: signedIn,
  });
}

export function useOnboardSeller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StoreOnboardIn) =>
      safeApi<SellerStore>("/sellers/onboard", { method: "POST", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.myStores });
      void queryClient.invalidateQueries({ queryKey: qk.me });
    },
  });
}

/**
 * Edit the store profile.
 *
 * The panel reads the store from `/sellers/me`, so that is what a successful
 * PATCH invalidates; the store scope goes with it because a renamed store or a
 * moved pin shows up on several screens at once.
 */
export function useUpdateStore(sellerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StoreUpdateIn) =>
      safeApi<SellerStore>(`/sellers/${sellerId}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.myStores });
      void queryClient.invalidateQueries({ queryKey: qk.sellerScope(sellerId) });
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

/* --- payout cards --------------------------------------------------------------
 * Where the money lands. A card is added once, verified by SMS code, and from
 * then on is only ever referred to by its id — the number itself never makes a
 * second trip through this app.
 */
export function usePayoutMethods(sellerId: string) {
  return useQuery({
    queryKey: qk.payoutMethods(sellerId),
    queryFn: () => safeApi<PayoutMethodOut[]>(`/seller/${sellerId}/finance/methods`),
    enabled: Boolean(sellerId),
  });
}

export function useAddCard(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (input: CardIn) =>
      safeApi<CardAddedOut>(`/seller/${sellerId}/finance/methods`, {
        method: "POST",
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useVerifyCard(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: ({ methodId, code }: { methodId: string; code: string }) =>
      safeApi<PayoutMethodOut>(`/seller/${sellerId}/finance/methods/${methodId}/verify`, {
        method: "POST",
        body: { code },
      }),
    onSuccess: invalidate,
  });
}

export function useResendCardCode(sellerId: string) {
  return useMutation({
    mutationFn: (methodId: string) =>
      safeApi<CardCodeResent>(`/seller/${sellerId}/finance/methods/${methodId}/resend`, {
        method: "POST",
      }),
  });
}

export function useMakeDefaultCard(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (methodId: string) =>
      safeApi<PayoutMethodOut>(`/seller/${sellerId}/finance/methods/${methodId}/default`, {
        method: "POST",
      }),
    onSuccess: invalidate,
  });
}

export function useRevokeCard(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (methodId: string) =>
      safeApi<void>(`/seller/${sellerId}/finance/methods/${methodId}`, { method: "DELETE" }),
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

/* --- uploads ----------------------------------------------------------------------
 * Files are the one thing this app does not send as JSON, so they do not go
 * through `api()`. They go through XMLHttpRequest instead of `fetch`, for the
 * single reason that `fetch` cannot report how much of a body has gone out yet
 * — and a seller on a phone uploading a 4 MB photo of a licence needs to see a
 * bar move, or they press the button again.
 */
const UPLOAD_BASE = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api/v1";

export type UploadPurpose =
  | "AVATAR"
  | "STORE_LOGO"
  | "STORE_ICON"
  | "STORE_BANNER"
  | "PRODUCT_IMAGE"
  | "SELLER_DOCUMENT"
  | "AD_CREATIVE"
  | "OTHER";

export type UploadOut = {
  id: string;
  purpose: UploadPurpose;
  seller_id: string | null;
  original_filename: string;
  url: string;
  thumbnail_url: string | null;
  content_type: string;
  size_bytes: number;
  checksum: string;
  /** A seller's papers are stored privately: the URL alone will not open them. */
  is_private: boolean;
  created_at: string;
};

export type UploadRequest = {
  file: File;
  purpose: UploadPurpose;
  /** Every store-scoped purpose needs one; the server refuses the upload without it. */
  sellerId?: string | undefined;
};

function postUpload(
  input: UploadRequest,
  onProgress?: ((percent: number) => void) | undefined,
): Promise<UploadOut> {
  return new Promise<UploadOut>((resolve, reject) => {
    const form = new FormData();
    form.append("file", input.file);
    form.append("purpose", input.purpose);
    if (input.sellerId) form.append("seller_id", input.sellerId);

    const request = new XMLHttpRequest();
    request.open("POST", `${UPLOAD_BASE}/uploads`);
    request.setRequestHeader("Accept", "application/json");
    const access = tokens.access();
    if (access) request.setRequestHeader("Authorization", `Bearer ${access}`);
    // Content-Type is deliberately not set: the browser has to add the
    // multipart boundary itself.

    request.upload.addEventListener("progress", (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("load", () => {
      let parsed: unknown = null;
      try {
        parsed = request.responseText ? JSON.parse(request.responseText) : null;
      } catch {
        parsed = null;
      }
      if (request.status >= 200 && request.status < 300) {
        resolve(parsed as UploadOut);
        return;
      }
      // The server explains a refused file precisely — wrong type, too large,
      // unreadable image — and that sentence is what the seller needs to read,
      // so it is carried through rather than replaced.
      reject(
        new ApiError(request.status, parsed as ApiErrorBody | null, "Faylni yuklab bo'lmadi."),
      );
    });
    request.addEventListener("error", () =>
      reject(new ApiError(0, null, "Internet aloqasi yo'q. Qayta urinib ko'ring.")),
    );
    request.addEventListener("abort", () => reject(new ApiError(0, null, "Yuklash to'xtatildi.")));

    request.send(form);
  });
}

async function uploadFile(
  input: UploadRequest,
  onProgress?: ((percent: number) => void) | undefined,
): Promise<UploadOut> {
  try {
    return await postUpload(input, onProgress);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    // Token refresh lives in the API client and only runs on a 401 the client
    // itself sees. One cheap authenticated GET puts a fresh token in place
    // without duplicating that logic here, and then the file goes again.
    await safeApi<UploadOut[]>("/uploads/me");
    return postUpload(input, onProgress);
  }
}

export function useUploadFile(
  options: { onProgress?: ((percent: number) => void) | undefined } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadRequest) => uploadFile(input, options.onProgress),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: qk.myUploads });
      if (row.seller_id) {
        void queryClient.invalidateQueries({ queryKey: qk.sellerScope(row.seller_id) });
      }
    },
  });
}

/** Everything this person has ever uploaded, newest first. */
export function useMyUploads() {
  const signedIn = useIsAuthenticated();
  return useQuery({
    queryKey: qk.myUploads,
    queryFn: () => safeApi<UploadOut[]>("/uploads/me"),
    enabled: signedIn,
  });
}

export function useDeleteUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => safeApi<void>(`/uploads/${fileId}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.myUploads }),
  });
}

/* --- orders ---------------------------------------------------------------------- */
/** The address card the server hands over, links included. */
export type OrderDeliveryAddress = {
  line: string;
  lat: string | null;
  lng: string | null;
  /** `yandexnavi://` deep link. Null when the order carries no usable point. */
  navigator_url: string | null;
  maps_url: string | null;
  pin_url: string | null;
};

export type SellerOrderRow = {
  /** The sub-order id. Not what the status endpoint takes — see `order_id`. */
  id: string;
  order_id: string;
  order_number: string;
  status: string;
  subtotal: string;
  delivery_fee: string;
  created_at: string;
  recipient_name: string;
  recipient_phone: string;
  /** False when the buyer ordered for someone else, who is the one to ring. */
  contact_is_self: boolean;
  payment_method: string;
  comment: string | null;
  promised_date: string | null;
  late: boolean;
  /** Buyer-facing timeline step: placed, packing, ready, on_the_way, delivered. */
  stage: string | null;
  delivery_address: OrderDeliveryAddress;
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
      /** The parent order id — the endpoint loads an order, not a sub-order. */
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

/* --- the ad wizard's one submit ---------------------------------------------
 * A campaign and the slide it shows are two calls, but one decision: a seller
 * who pressed "create" meant both, and a campaign with no creative buys nothing.
 * They are sequenced here rather than in the component so the partial state has
 * exactly one honest name — the campaign exists, the creative did not attach —
 * and the screen can say so instead of silently losing the picture.
 */
export type CampaignWithCreativeIn = CampaignIn & {
  creative: Omit<CreativeIn, "sort_order">;
  /** Send it straight to moderation instead of leaving it a draft. */
  submitForReview?: boolean | undefined;
};

export type CampaignWithCreativeResult = {
  campaign: CampaignOut;
  creative: CreativeOut | null;
  /** Set when the campaign was created but a later step refused. */
  partialError: ApiError | null;
};

export function useCreateCampaignWithCreative(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: async ({
      creative,
      submitForReview = false,
      ...campaignBody
    }: CampaignWithCreativeIn): Promise<CampaignWithCreativeResult> => {
      const campaign = await safeApi<CampaignOut>(`/seller/${sellerId}/ads/campaigns`, {
        method: "POST",
        body: campaignBody,
      });

      let attached: CreativeOut | null = null;
      try {
        attached = await safeApi<CreativeOut>(
          `/seller/${sellerId}/ads/campaigns/${campaign.id}/creatives`,
          { method: "POST", body: { ...creative, sort_order: 0 } },
        );
      } catch (error) {
        // The money has not moved — a DRAFT campaign spends nothing — so the
        // campaign is kept and the seller is told which half is missing.
        return {
          campaign,
          creative: null,
          partialError:
            error instanceof ApiError
              ? error
              : new ApiError(0, null, "Reklama materialini biriktirib bo'lmadi."),
        };
      }

      if (!submitForReview) return { campaign, creative: attached, partialError: null };

      try {
        const reviewed = await safeApi<CampaignOut>(
          `/seller/${sellerId}/ads/campaigns/${campaign.id}/status`,
          { method: "POST", body: { status: "PENDING_REVIEW" } },
        );
        return { campaign: reviewed, creative: attached, partialError: null };
      } catch (error) {
        return {
          campaign,
          creative: attached,
          partialError:
            error instanceof ApiError
              ? error
              : new ApiError(0, null, "Kampaniyani tekshiruvga yuborib bo'lmadi."),
        };
      }
    },
    onSuccess: invalidate,
  });
}

/* --- the feed studio ------------------------------------------------------------
 * Clips, the numbers they produce, and the two uploads behind them. Appended
 * rather than woven in: the videos module landed after this file was written
 * and `schema.d.ts` does not describe it yet, so the shapes below are written
 * by hand from `app/modules/videos` and become redundant — not wrong — when the
 * OpenAPI types are regenerated.
 */

/** The four chips on the statistics screen. The server refuses anything else. */
export type StatsWindow = "7" | "30" | "90" | "all";

export type CreatorTile = {
  total: number;
  /** Null over "Barcha": there is no window before all of time to compare to. */
  previous: number | null;
  /** Null when there is no baseline — never 0, which would read as "flat". */
  change_percent: number | null;
  windowed: boolean;
};

export type CreatorStats = {
  window: StatsWindow;
  days: number;
  since: string;
  previous_since: string | null;
  tiles: {
    views: CreatorTile;
    likes: CreatorTile;
    comments: CreatorTile;
    shares: CreatorTile;
  };
  /** One point per day, zero days included, so the line has no holes in it. */
  views_by_day: { day: string; views: number }[];
  /** How much of `days` the line actually covers — "all" is capped at a year. */
  series_days: number;
  audience: {
    by_region: {
      unit: string;
      /** An anonymous view has no region; the clip's stands in. */
      source: string;
      rows: { region: string; views: number }[];
    };
    by_follow: { unit: string; followers: number; non_followers: number; anonymous: number };
    by_recency: { unit: string; new: number; returning: number; anonymous_views: number };
    /**
     * Always null, and typed that way on purpose: nothing in this system stores
     * a birth date, so the design's age panel has no data behind it and the
     * server says so in `by_age_note` instead of inventing bands.
     */
    by_age: null;
    by_age_note: string;
  };
  top_videos: {
    video_id: string;
    caption: string | null;
    thumbnail_url: string | null;
    published_at: string | null;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }[];
};

export type VideoStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "REMOVED";
export type VideoModerationStatus =
  "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "REMOVED";

export type TaggedProduct = {
  product_id: string;
  offer_id: string | null;
  name: string;
  slug: string;
  image_url: string | null;
  price: string | null;
  currency: string;
  in_stock: boolean;
  position_x: string | null;
  position_y: string | null;
  start_second: number | null;
  sort_order: number;
};

export type TaggedVehicle = {
  variant_id: string | null;
  model_id: string | null;
  label: string;
};

export type CreatorVideo = {
  id: string;
  seller_id: string | null;
  author_id: string;
  caption: string | null;
  hashtags: string[];
  region: string | null;
  district: string | null;
  status: VideoStatus;
  moderation_status: VideoModerationStatus;
  /** The one field to branch on; everything else is the reason behind it. */
  is_public: boolean;
  /** What is still standing between this clip and the feed, already in Uzbek. */
  pending: string[];
  playback_url: string | null;
  hls_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  save_count: number;
  share_count: number;
  published_at: string | null;
  created_at: string;
  products: TaggedProduct[];
  vehicles: TaggedVehicle[];
};

/** A tile in the grid. The three moderation fields are filled for the owner. */
export type CreatorVideoCard = {
  id: string;
  thumbnail_url: string | null;
  playback_url: string | null;
  caption: string | null;
  duration_seconds: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  published_at: string | null;
  status: VideoStatus | null;
  moderation_status: VideoModerationStatus | null;
  is_public: boolean | null;
};

export type CreatorVideoGrid = {
  tab: "videos" | "products" | "saved";
  items: CreatorVideoCard[];
  products: TaggedProduct[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
};

export type VideoProductTagIn = {
  product_id: string;
  /** Left out: the server fills in this store's own offer for the product. */
  offer_id?: string | undefined;
  sort_order?: number | undefined;
};

export type VideoVehicleTagIn = {
  variant_id?: string | undefined;
  model_id?: string | undefined;
};

export type VideoCreateBody = {
  file_id: string;
  thumbnail_file_id?: string | undefined;
  caption?: string | undefined;
  hashtags?: string[] | undefined;
  region?: string | undefined;
  district?: string | undefined;
  duration_seconds?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  products?: VideoProductTagIn[] | undefined;
  vehicles?: VideoVehicleTagIn[] | undefined;
};

/**
 * Everything left out is left alone — except the two tag lists, where a list
 * sent at all replaces the whole set, because there is no way to say "drop this
 * one tag" in a body that only ever adds.
 */
export type VideoUpdateBody = {
  caption?: string | undefined;
  hashtags?: string[] | undefined;
  region?: string | undefined;
  district?: string | undefined;
  thumbnail_file_id?: string | undefined;
  products?: VideoProductTagIn[] | undefined;
  vehicles?: VideoVehicleTagIn[] | undefined;
};

export function useCreatorStats(sellerId: string, window: StatsWindow) {
  return useQuery({
    queryKey: qk.creatorStats(sellerId, window),
    queryFn: () =>
      safeApi<CreatorStats>(`/seller/${sellerId}/feed/stats`, { query: { days: window } }),
    enabled: Boolean(sellerId),
  });
}

export function useSellerVideos(sellerId: string, page = 1, perPage = 12) {
  return useQuery({
    queryKey: qk.sellerVideos(sellerId, page, perPage),
    queryFn: () =>
      safeApi<CreatorVideoGrid>(`/seller/${sellerId}/videos`, {
        query: { page, per_page: perPage },
      }),
    enabled: Boolean(sellerId),
  });
}

/**
 * One clip in full. The grid tile carries no caption tags, no region and no
 * product tags, so the edit form loads the whole row rather than editing from
 * a summary and silently blanking whatever the summary left out.
 */
export function useSellerVideo(sellerId: string, videoId: string | null) {
  return useQuery({
    queryKey: qk.sellerVideo(sellerId, videoId ?? ""),
    queryFn: () => safeApi<CreatorVideo>(`/seller/${sellerId}/videos/${videoId ?? ""}`),
    enabled: Boolean(sellerId) && Boolean(videoId),
  });
}

export function useCreateVideo(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (body: VideoCreateBody) =>
      safeApi<CreatorVideo>(`/seller/${sellerId}/videos`, { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useUpdateVideo(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: ({ videoId, ...body }: VideoUpdateBody & { videoId: string }) =>
      safeApi<CreatorVideo>(`/seller/${sellerId}/videos/${videoId}`, { method: "PATCH", body }),
    onSuccess: invalidate,
  });
}

export function useDeleteVideo(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    // The row comes back rather than a 204, so the screen can show the clip as
    // removed instead of guessing that something happened.
    mutationFn: (videoId: string) =>
      safeApi<CreatorVideo>(`/seller/${sellerId}/videos/${videoId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function usePublishVideo(sellerId: string) {
  const invalidate = useScopeInvalidator(sellerId);
  return useMutation({
    mutationFn: (videoId: string) =>
      safeApi<CreatorVideo>(`/seller/${sellerId}/videos/${videoId}/publish`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

/**
 * The clip itself and its still frame.
 *
 * Both go through the same `/uploads` endpoint and the same progress-reporting
 * XHR as every other file — a 200 MB clip is exactly the case a progress bar
 * exists for. `UploadPurpose` above was written before the feed module existed
 * and this file is only ever appended to, so the two new purposes are named
 * here; the server's enum carries both.
 */
export type CreatorUploadPurpose = "VIDEO" | "VIDEO_THUMBNAIL";

export type CreatorUploadRequest = {
  file: File;
  purpose: CreatorUploadPurpose;
  /**
   * Not required by the server for these two purposes, but sent anyway: it
   * makes the file reachable by the store's other staff, so the person who
   * films and the person who writes the caption need not be the same person.
   */
  sellerId: string;
};

export function useUploadCreatorFile(
  options: { onProgress?: ((percent: number) => void) | undefined } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatorUploadRequest) =>
      uploadFile(
        {
          file: input.file,
          purpose: input.purpose as unknown as UploadPurpose,
          sellerId: input.sellerId,
        },
        options.onProgress,
      ),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: qk.myUploads });
      if (row.seller_id) {
        void queryClient.invalidateQueries({ queryKey: qk.sellerScope(row.seller_id) });
      }
    },
  });
}
