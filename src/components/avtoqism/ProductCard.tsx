import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Loader2, ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";

import type { ProductListItem } from "@/lib/api/types";
import { formatSom } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { useAddToCart } from "@/lib/query/commerce";
import { cn } from "@/lib/utils";
import { FitBadge } from "./FitBadge";

export function ProductCard({
  product,
  compact,
}: {
  product: ProductListItem;
  compact?: boolean | undefined;
}) {
  const { lang } = useLang();
  const t = useT();
  const addToCart = useAddToCart();

  const name = (lang === "uz" ? product.name_uz : product.name_ru) ?? product.name_uz;
  const offer = product.best_offer;
  const discount = offer.discount_percent;
  const soldOut = offer.available <= 0;

  return (
    <article
      className={cn(
        "group relative flex flex-col border border-border bg-card transition-colors hover:border-border-strong",
        compact && "min-w-[220px]",
      )}
    >
      <Link
        to="/product/$productId"
        params={{ productId: product.slug }}
        className="relative block aspect-square overflow-hidden bg-muted"
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={name}
            loading="lazy"
            className="image-zoom size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-xs text-muted-foreground">
            {product.brand_name ?? "AVTOQISM"}
          </span>
        )}
        {discount != null && (
          <span className="absolute left-0 top-0 bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground">
            −{discount}%
          </span>
        )}
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/85 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-background">
            {t("common.outOfStock")}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          {product.compatibility ? (
            <FitBadge compatibility={product.compatibility} />
          ) : (
            <span className="type-label text-muted-foreground">{product.brand_name ?? ""}</span>
          )}
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>

        <Link
          to="/product/$productId"
          params={{ productId: product.slug }}
          className="type-h3 line-clamp-2 hover:text-primary"
        >
          {name}
        </Link>

        <div className="type-caption flex items-center gap-2">
          {product.rating_count > 0 && (
            <>
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Star className="size-3.5 fill-primary text-primary" />
                {Number(product.rating_avg).toFixed(1)}
              </span>
              <span>·</span>
            </>
          )}
          <span className="truncate">{offer.seller.store_name}</span>
        </div>

        <div className="mt-auto pt-2">
          <div className="flex items-baseline gap-2">
            <span className="type-price">{formatSom(offer.price)}</span>
            {offer.old_price && (
              <span className="text-xs text-muted-foreground line-through">
                {formatSom(offer.old_price)}
              </span>
            )}
          </div>
          {product.offer_count > 1 && (
            <p className="type-caption mt-1">
              {product.offer_count} {t("common.sellers").toLowerCase()}
            </p>
          )}

          <button
            type="button"
            disabled={soldOut || addToCart.isPending}
            onClick={() => {
              addToCart.mutate(
                { offer_id: offer.id, quantity: 1 },
                {
                  onSuccess: () => toast.success(t("common.addToCart"), { description: name }),
                  onError: (error) => toast.error((error as Error).message),
                },
              );
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {addToCart.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShoppingBag className="size-4" />
            )}
            {t("common.addToCart")}
          </button>
        </div>
      </div>
    </article>
  );
}
