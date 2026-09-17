import { Link } from "@tanstack/react-router";
import { Heart, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatSom } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { fitmentFor, useStore } from "@/lib/store";
import { getSeller, type Product } from "@/data/demo";
import { FitBadge } from "./FitBadge";

export function ProductCard({ product, compact }: { product: Product; compact?: boolean }) {
  const { lang } = useLang();
  const t = useT();
  const { activeVehicle, wishlist, toggleWishlist, addToCart } = useStore();
  const fitment = fitmentFor(product.fitsModels, activeVehicle?.model);
  const best = [...product.offers].sort((a, b) => a.price - b.price)[0];
  const seller = getSeller(best.sellerId);
  const saved = wishlist.includes(product.id);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border-strong",
        compact && "min-w-[220px]",
      )}
    >
      <Link
        to="/product/$productId"
        params={{ productId: product.id }}
        className="relative block aspect-square overflow-hidden bg-secondary"
      >
        <img
          src={product.image}
          alt={lang === "uz" ? product.nameUz : product.nameRu}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {product.oldPrice && (
          <span className="absolute left-2 top-2 rounded-md bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">
            −{Math.round((1 - product.price / product.oldPrice) * 100)}%
          </span>
        )}
      </Link>

      <button
        type="button"
        onClick={() => toggleWishlist(product.id)}
        aria-label="wishlist"
        className="absolute right-2 top-2 grid size-8 place-items-center rounded-md border border-border bg-card/90 backdrop-blur transition-colors hover:border-border-strong"
      >
        <Heart className={cn("size-4", saved && "fill-destructive text-destructive")} />
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {fitment === "fit" && <FitBadge fitment="fit" />}
        <Link
          to="/product/$productId"
          params={{ productId: product.id }}
          className="type-h3 line-clamp-2 hover:text-accent-electric"
        >
          {lang === "uz" ? product.nameUz : product.nameRu}
        </Link>
        <div className="flex items-center gap-2 type-caption">
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <Star className="size-3.5 fill-warning text-warning" />
            {product.rating}
          </span>
          <span>·</span>
          <span className="truncate">{seller.name}</span>
        </div>

        <div className="mt-auto pt-1">
          <div className="flex items-baseline gap-2">
            <span className="type-price">{formatSom(best.price)}</span>
            {product.oldPrice && (
              <span className="text-xs text-muted-foreground line-through">
                {formatSom(product.oldPrice)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              addToCart(product.id, best.sellerId);
              toast.success(t("common.addToCart"), {
                description: lang === "uz" ? product.nameUz : product.nameRu,
              });
            }}
            className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t("common.addToCart")}
          </button>
        </div>
      </div>
    </article>
  );
}
