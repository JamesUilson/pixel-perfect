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
