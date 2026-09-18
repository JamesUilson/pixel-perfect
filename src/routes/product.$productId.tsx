import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, ShieldCheck, Star, Truck } from "lucide-react";
import { toast } from "sonner";
import { Page } from "@/components/motora/Page";
import { FitBadge } from "@/components/motora/FitBadge";
import { ProductCard } from "@/components/motora/ProductCard";
import { getProduct, getSeller, products } from "@/data/demo";
import { formatSom } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { fitmentFor, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$productId")({
  loader: ({ params }) => {
    const product = getProduct(params.productId);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Topilmadi — MOTORA" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.product.nameUz} — MOTORA`;
    const description = `${loaderData.product.brand} · OEM ${loaderData.product.oem} · ${formatSom(loaderData.product.price)}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const { activeVehicle, addToCart, wishlist, toggleWishlist } = useStore();

  const offers = [...product.offers].sort((a, b) => a.price - b.price);
  const [sellerId, setSellerId] = useState(offers[0].sellerId);
  const [qty, setQty] = useState(1);
  const offer = offers.find((o) => o.sellerId === sellerId) ?? offers[0];
  const seller = getSeller(offer.sellerId);
  const fitment = fitmentFor(product.fitsModels, activeVehicle?.model);
  const saved = wishlist.includes(product.id);
  const name = lang === "uz" ? product.nameUz : product.nameRu;

  const related = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <Page>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-secondary">
          <img src={product.image} alt={name} className="aspect-square w-full object-cover" />
        </div>

        <div>
          <p className="type-label text-muted-foreground">{product.brand}</p>
          <h1 className="type-h1 mt-2">{name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 type-caption">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Star className="size-4 fill-warning text-warning" />
              {product.rating}
            </span>
            <span>
              {product.reviews} {t("common.reviews")}
            </span>
            <span>·</span>
            <span>
              {product.sold} {t("common.pcs")}
            </span>
            <span>·</span>
            <span>
              {t("product.oem")}: {product.oem}
            </span>
          </div>

          <div className="mt-4">
            <FitBadge fitment={fitment} size="lg" />
          </div>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="type-price-lg">{formatSom(offer.price)}</span>
            {product.oldPrice && (
              <span className="text-sm text-muted-foreground line-through">
                {formatSom(product.oldPrice)}
              </span>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <p className="type-label mb-3 text-muted-foreground">{t("product.compare")}</p>
            <div className="space-y-2">
              {offers.map((o) => {
                const s = getSeller(o.sellerId);
                return (
                  <button
                    key={o.sellerId}
                    type="button"
                    onClick={() => setSellerId(o.sellerId)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                      o.sellerId === sellerId
                        ? "border-accent-electric bg-accent"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {s.name}
                        {s.verified && <ShieldCheck className="size-3.5 text-success" />}
                      </span>
                      <span className="type-caption block truncate">
                        {s.district} · {lang === "uz" ? s.deliveryUz : s.deliveryRu}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="type-price block">{formatSom(o.price)}</span>
                      <span className="type-caption">
                        {o.stock} {t("common.pcs")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="inline-flex items-center rounded-md border border-border">
              <button
                type="button"
                className="px-3 py-2 text-lg"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="w-10 text-center text-sm font-bold">{qty}</span>
              <button
                type="button"
                className="px-3 py-2 text-lg"
                onClick={() => setQty((q) => Math.min(offer.stock, q + 1))}
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              className="grid size-11 place-items-center rounded-md border border-border"
              aria-label="wishlist"
            >
              <Heart className={cn("size-4", saved && "fill-destructive text-destructive")} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                addToCart(product.id, offer.sellerId, qty);
                toast.success(t("common.addToCart"), { description: name });
              }}
              className="flex-1 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              {t("common.addToCart")}
            </button>
            <button
              type="button"
              onClick={() => {
                addToCart(product.id, offer.sellerId, qty);
                navigate({ to: "/cart" });
              }}
              className="flex-1 rounded-md bg-accent-electric px-5 py-3 text-sm font-semibold text-accent-electric-foreground"
            >
              {t("common.buyNow")}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="type-label text-muted-foreground">{t("common.delivery")}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold">
                <Truck className="size-4 text-accent-electric" />
                {lang === "uz" ? seller.deliveryUz : seller.deliveryRu}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="type-label text-muted-foreground">{t("common.warranty")}</p>
              <p className="mt-1 text-sm font-semibold">
                {lang === "uz" ? product.warrantyUz : product.warrantyRu}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="type-h2 mb-4">{t("product.specs")}</h2>
          <dl className="divide-y divide-border">
            {product.specs.map((s) => (
              <div key={s.value} className="flex justify-between gap-4 py-2.5 text-sm">
                <dt className="text-muted-foreground">{lang === "uz" ? s.uz : s.ru}</dt>
                <dd className="font-semibold">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="type-h2 mb-4">{t("product.fits")}</h2>
          <div className="flex flex-wrap gap-2">
            {product.fitsModels.map((m) => (
              <span
                key={m}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-semibold",
                  activeVehicle?.model === m
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-border",
                )}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-10">
          <h2 className="type-h2 mb-4">{t("home.explore")}</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <Link to="/marketplace" className="text-sm font-semibold text-accent-electric">
          ← {t("nav.market")}
        </Link>
      </div>
    </Page>
  );
}
