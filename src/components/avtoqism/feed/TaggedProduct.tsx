import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { formatSom } from "@/lib/format";
import type { FeedProduct, TaggedProduct as TaggedProductOut } from "@/lib/query/feed";
import { cn } from "@/lib/utils";

/**
 * The tagged product over the clip.
 *
 * The price is whatever the server joined on this request — the feed never
 * carries a stored price, because a video tagged in March must not quote
 * March's money in September. A product nobody sells right now has no price,
 * and says so rather than showing a zero.
 */
export function TaggedProductCard({
  product,
  className,
}: {
  product: FeedProduct;
  className?: string | undefined;
}) {
  return (
    <Link
      to="/product/$productId"
      params={{ productId: product.slug }}
      className={cn(
        "flex items-center gap-3 border border-border bg-background/70 p-3 backdrop-blur-md",
        className,
      )}
    >
      {product.image_url ? (
        <img
          src={product.image_url}
          alt=""
          className="size-14 shrink-0 object-cover"
          loading="lazy"
        />
      ) : (
        <span className="size-14 shrink-0 bg-muted" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{product.name}</span>
        <span className="block text-xs text-muted-foreground">
          {product.price !== null ? formatSom(product.price) : "Hozircha sotuvda yo'q"}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/** One tile of the detail screen's "Mahsulotlar" strip. */
export function ProductStripTile({
  product,
  highlighted = false,
}: {
  product: FeedProduct | TaggedProductOut;
  highlighted?: boolean | undefined;
}) {
  return (
    <Link
      to="/product/$productId"
      params={{ productId: product.slug }}
      className="block w-36 shrink-0 snap-start"
    >
      <span
        className={cn(
          "block aspect-square overflow-hidden bg-muted",
          highlighted && "ring-2 ring-primary",
        )}
      >
        {product.image_url && (
          <img src={product.image_url} alt="" className="size-full object-cover" loading="lazy" />
        )}
      </span>
      <span className="mt-2 block truncate text-sm font-semibold">{product.name}</span>
      <span className="block text-xs text-muted-foreground">
        {product.price !== null ? formatSom(product.price) : "Narx yo'q"}
      </span>
    </Link>
  );
}
