/**
 * Hand-picked aliases over the generated OpenAPI schema.
 *
 * Components import from here, never from `schema.d.ts` directly, so a rename
 * in the API surfaces as one edit in this file instead of fifty.
 */
import type { components } from "./schema";

type S = components["schemas"];

export type UserOut = S["UserOut"];
export type AuthResult = S["AuthResult"];
export type TokenPair = S["TokenPair"];

export type BrandOut = S["BrandOut"];
export type ModelOut = S["ModelOut"];
export type VariantOut = S["VariantOut"];
export type EngineOut = S["EngineOut"];

export type GarageVehicleOut = S["GarageVehicleOut"];
export type GarageVehicleIn = S["GarageVehicleIn"];

export type CategoryOut = S["CategoryOut"];
export type PartBrandOut = S["PartBrandOut"];

export type ProductListItem = S["ProductListItem"];
export type ProductDetail = S["ProductDetail"];
export type OfferOut = S["OfferOut"];
export type SellerBrief = S["SellerBrief"];
export type SellerOut = S["SellerOut"];

export type CompatibilityOut = S["CompatibilityOut"];
export type CompatStatus = S["CompatStatus"];
export type CompatSource = S["CompatSource"];

export type CartOut = S["CartOut"];
export type CartLineOut = S["CartLineOut"];
export type CartSellerGroup = S["CartSellerGroup"];

export type OrderOut = S["OrderOut"];
export type SubOrderOut = S["SubOrderOut"];
export type OrderStatus = S["OrderStatus"];
export type CheckoutIn = S["CheckoutIn"];
export type AddressIn = S["AddressIn"];
export type PaymentMethod = S["PaymentMethod"];
export type DeliveryMethod = S["DeliveryMethod"];

export type SortOrder = S["SortOrder"];

/* --- seller panel ---------------------------------------------------------- */
export type WarehouseOut = S["WarehouseOut"];
export type WarehouseIn = S["WarehouseIn"];
export type WarehouseUpdateIn = S["WarehouseUpdateIn"];
export type WarehouseSummaryOut = S["WarehouseSummaryOut"];
export type StockRowOut = S["StockRowOut"];
export type StockAdjustIn = S["StockAdjustIn"];
export type StockTransferIn = S["StockTransferIn"];
export type StockSettingsIn = S["StockSettingsIn"];
export type MovementOut = S["MovementOut"];
export type StockMovementKind = S["StockMovementKind"];

export type BalanceOut = S["BalanceOut"];
export type LedgerEntryOut = S["LedgerEntryOut"];
export type AccountTotalOut = S["AccountTotalOut"];
export type PayoutOut = S["PayoutOut"];
export type PayoutRequestIn = S["PayoutRequestIn"];
export type PayoutDecisionIn = S["PayoutDecisionIn"];
export type PayoutStatus = S["PayoutStatus"];
export type CommissionRuleOut = S["CommissionRuleOut"];
export type CommissionRuleIn = S["CommissionRuleIn"];
export type LedgerAccount = S["LedgerAccount"];

export type PromotionOut = S["PromotionOut"];
export type PromotionIn = S["PromotionIn"];
export type PromotionUpdateIn = S["PromotionUpdateIn"];
export type PromotionKind = S["PromotionKind"];
export type PromotionScope = S["PromotionScope"];
export type RedemptionOut = S["RedemptionOut"];

export type CampaignOut = S["CampaignOut"];
export type CampaignIn = S["CampaignIn"];
export type CampaignUpdateIn = S["CampaignUpdateIn"];
export type CampaignStatusIn = S["CampaignStatusIn"];
export type CampaignDayOut = S["CampaignDayOut"];
export type CreativeIn = S["CreativeIn"];
export type CreativeOut = S["CreativeOut"];
export type PlacementOut = S["PlacementOut"];
export type PlacementIn = S["PlacementIn"];
export type BannerOut = S["BannerOut"];
export type BannerIn = S["BannerIn"];
export type BannerUpdateIn = S["BannerUpdateIn"];
export type SlideOut = S["SlideOut"];
export type AdSlot = S["AdSlot"];
export type AdCampaignStatus = S["AdCampaignStatus"];
export type AdEventKind = S["AdEventKind"];

export type SellerOnboardIn = S["SellerOnboardIn"];
export type SellerUpdateIn = S["SellerUpdateIn"];
export type AppliedPromotionOut = S["AppliedPromotionOut"];

/**
 * Dashboard payloads.
 *
 * The analytics endpoints return chart data rather than entities, and their
 * shape follows the charts. They are typed here by hand rather than generated,
 * because FastAPI describes them only as `object`.
 */
export type SellerOverview = {
  days: number;
  gross_sales: string;
  gross_sales_previous: string;
  gross_sales_change_percent: number;
  net_earnings: string;
  commission_paid: string;
  discounts_given: string;
  order_count: number;
  order_count_previous: number;
  order_count_change_percent: number;
  units_sold: number;
  average_order_value: string;
  open_orders: number;
  low_stock_count: number;
  stock_units: number;
  stock_retail_value: string;
  ad_spend: string;
};

export type PlatformOverview = {
  days: number;
  gmv: string;
  gmv_previous: string;
  gmv_change_percent: number;
  order_count: number;
  order_count_previous: number;
  order_count_change_percent: number;
  average_order_value: string;
  commission_revenue: string;
  delivery_revenue: string;
  ad_revenue: string;
  total_revenue: string;
  total_revenue_previous: string;
  discounts_given: string;
  refunded: string;
  escrow_held: string;
  owed_to_sellers: string;
  sellers_total: number;
  sellers_active: number;
  users_total: number;
  users_new: number;
};

export type SalesDay = { day: string; revenue: string; orders: number };
export type GmvDay = {
  day: string;
  gmv: string;
  orders: number;
  commission: string;
  delivery: string;
  ads: string;
};
export type MoneyFlowDay = {
  day: string;
  earnings: string;
  commission: string;
  ads: string;
  payouts: string;
};
export type StatusCount = { status: OrderStatus; count: number; amount: string };
export type TopProduct = {
  product_id: string | null;
  product_name: string;
  units: number;
  revenue: string;
  orders: number;
};
export type TopSeller = {
  seller_id: string;
  store_name: string;
  slug: string;
  sales: string;
  orders: number;
  commission: string;
};
export type CategorySlice = { category: string; revenue: string; units: number };
export type WarehouseStock = {
  warehouse: string;
  units: number;
  reserved: number;
  retail_value: string;
};
export type UserGrowthDay = { day: string; users: number };
export type AdDay = { day: string; revenue: string; impressions: number; clicks: number };
export type InventoryHealth = {
  units: number;
  reserved: number;
  retail_value: string;
  out_of_stock_offers: number;
  warehouses: number;
};
export type CustomerSummary = {
  total_spent: string;
  total_saved: string;
  order_count: number;
  orders_in_progress: number;
  first_order_at: string | null;
  average_order_value: string;
};
export type LedgerIntegrity = {
  balanced: boolean;
  groups: { group_id: string; difference: string }[];
};

/** Paginated envelope. The generated types name one per item type. */
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
};

/** The shape every failing response uses. */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    message_ru?: string;
    message_en?: string;
    details?: Record<string, unknown>;
    incident_id?: string;
  };
};
