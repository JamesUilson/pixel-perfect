import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  Loader2,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FitBadge } from "@/components/avtoqism/FitBadge";
import { Page } from "@/components/avtoqism/Page";
import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { ApiError } from "@/lib/api/client";
import { formatSom } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { productQuery, useProduct } from "@/lib/query/catalog";
import { useAddToCart } from "@/lib/query/commerce";
import { useActiveVehicle } from "@/lib/query/garage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$productId")({
  /**
   * Prefetch on the server so the HTML a crawler receives already contains the
   * name, price and availability. The anonymous (variant-free) view is the one
   * that gets indexed; a signed-in visitor's browser refetches with their car.
   */
  loader: async ({ context, params }) => {
    try {
      const product = await context.queryClient.ensureQueryData(
        productQuery(params.productId, null),
      );
      return { product };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound();
      throw error;
    }
  },
  head: ({ loaderData }) => {
    const product = loaderData?.product;
    if (!product) {
      return {
        meta: [{ title: "Topilmadi — AVTOQISM" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${product.name_uz} — AVTOQISM`;
    const price = Number(product.best_offer.price);
    const description =
      product.description_uz?.slice(0, 160) ??
      `${product.brand_name ?? ""} ${product.name_uz}. ${formatSom(price)}. ${
        product.oem_numbers[0] ? `OEM ${product.oem_numbers[0]}.` : ""
      }`.trim();

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(product.image_url ? [{ property: "og:image", content: product.image_url }] : []),
        { property: "product:price:amount", content: String(price) },
        { property: "product:price:currency", content: "UZS" },
      ],
      links: [{ rel: "canonical", href: `/product/${product.slug}` }],
      // Structured data, so the listing can show a rich result.
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name_uz,
            description,
            sku: product.slug,
            ...(product.oem_numbers[0] ? { mpn: product.oem_numbers[0] } : {}),
            ...(product.brand_name
              ? { brand: { "@type": "Brand", name: product.brand_name } }
              : {}),
            ...(product.image_url ? { image: [product.image_url] } : {}),
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "UZS",
              lowPrice: price,
              offerCount: product.offer_count,
              availability:
                product.best_offer.available > 0
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
            },
            ...(product.rating_count > 0
              ? {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: Number(product.rating_avg),
                    reviewCount: product.rating_count,
                  },
                }
              : {}),
          }),
        },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { productId: slug } = Route.useParams();
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const { variantId, activeVehicle } = useActiveVehicle();

  const product = useProduct(slug, variantId);
  const addToCart = useAddToCart();

  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  if (product.isPending) {
    return (
      <Page>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
          <div className="aspect-[4/3] animate-pulse bg-muted" />
          <div className="space-y-4">
            <LineSkeleton className="w-24" />
            <LineSkeleton className="h-10 w-3/4" />
            <LineSkeleton className="w-1/2" />
            <LineSkeleton className="h-24 w-full" />
          </div>
        </div>
      </Page>
    );
  }

  if (product.isError) {
    return (
      <Page>
        <ErrorState error={product.error} onRetry={() => void product.refetch()} />
        <div className="mt-6">
          <Link to="/marketplace" className="text-sm font-semibold text-primary">
            ← {t("nav.market")}
          </Link>
        </div>
      </Page>
    );
  }

  const data = product.data;
  const name = (lang === "uz" ? data.name_uz : data.name_ru) ?? data.name_uz;
  const offers = data.offers.length > 0 ? data.offers : [data.best_offer];
  const offer = offers.find((o) => o.id === selectedOfferId) ?? offers[0]!;
  const maxQty = Math.max(offer.available, 1);
  const gallery = data.media.length > 0 ? data.media : null;

  return (
    <Page>
      <div className="mb-7 flex items-center justify-between">
        <Link
          to="/marketplace"
          className="flex items-center gap-2 text-sm font-semibold hover:text-primary"
        >
          <ChevronLeft className="size-4" /> {t("nav.market")}
        </Link>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
        {/* --- gallery ----------------------------------------------------- */}
        <section>
          <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            {gallery ? (
              <img
                src={gallery[0]!.url}
                alt={gallery[0]!.alt_uz ?? name}
                className="size-full object-cover"
              />
            ) : data.image_url ? (
              <img src={data.image_url} alt={name} className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center type-caption">
                {data.brand_name ?? "AVTOQISM"}
              </span>
            )}
          </div>
          {gallery && gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {gallery.slice(0, 4).map((m, i) => (
                <div
                  key={m.url}
                  className="aspect-[4/3] overflow-hidden border-2 border-transparent bg-muted"
                >
                  <img
                    src={m.thumbnail_url ?? m.url}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* specs and fitment live under the gallery on desktop */}
          {data.specs.length > 0 && (
            <div className="mt-10 border border-border bg-card p-6">
              <h2 className="type-h3 mb-4">{t("product.specs")}</h2>
              <dl className="divide-y divide-border">
                {data.specs.map((s) => (
                  <div
                    key={`${s.label_uz}-${s.value}`}
                    className="flex justify-between gap-4 py-3 text-sm"
                  >
                    <dt className="text-muted-foreground">
                      {lang === "uz" ? s.label_uz : (s.label_ru ?? s.label_uz)}
                    </dt>
                    <dd className="font-semibold">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {data.fits.length > 0 && (
            <div className="mt-6 border border-border bg-card p-6">
              <h2 className="type-h3 mb-4">{t("product.fits")}</h2>
              <div className="flex flex-wrap gap-2">
                {data.fits.map((f) => (
                  <span
                    key={f}
                    className={cn(
                      "border px-3 py-1.5 text-sm",
                      activeVehicle?.variant.display_name === f
                        ? "border-success bg-success-soft font-semibold text-success"
                        : "border-border",
                    )}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* --- buy box ----------------------------------------------------- */}
        <section className="lg:sticky lg:top-28 lg:self-start">
          {data.brand_name && <p className="type-label text-primary">{data.brand_name}</p>}
          <h1 className="type-h1 mt-4">{name}</h1>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
            <span className="inline-flex items-center gap-2 text-sm">
              {data.rating_count > 0 ? (
                <>
                  <Star className="size-4 fill-primary text-primary" />
                  <strong>{Number(data.rating_avg).toFixed(1)}</strong>
                  <span className="text-muted-foreground">
                    ({data.rating_count} {t("common.reviews").toLowerCase()})
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {data.sold_count} {t("product.sold")}
                </span>
              )}
            </span>
            {data.oem_numbers[0] && (
              <span className="type-caption">
                {t("product.oem")}: {data.oem_numbers.join(" · ")}
              </span>
            )}
          </div>

          <p className="type-price-lg mt-7">{formatSom(offer.price)}</p>
          {offer.old_price && (
            <p className="mt-1 text-sm text-muted-foreground line-through">
              {formatSom(offer.old_price)}
            </p>
          )}

          {data.description_uz && (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {(lang === "uz" ? data.description_uz : data.description_ru) ?? data.description_uz}
            </p>
          )}

          {/* compatibility, with its source */}
          <div className="mt-7">
            {variantId ? (
              <FitBadge compatibility={data.compatibility} size="lg" />
            ) : (
              <div className="border border-border bg-muted p-5">
                <p className="text-sm font-semibold">{t("home.noCar")}</p>
                <p className="type-caption mt-1">{t("home.noCarSub")}</p>
                <Link
                  to="/garage/add"
                  className="mt-4 inline-flex bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  {t("home.addCar")}
                </Link>
              </div>
            )}
          </div>

          {/* seller comparison */}
          {offers.length > 1 && (
            <div className="mt-7 border border-border bg-card p-5">
              <p className="type-label mb-4 text-muted-foreground">{t("product.compare")}</p>
              <div className="space-y-2">
                {offers.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setSelectedOfferId(o.id);
                      setQty(1);
                    }}
                    aria-pressed={o.id === offer.id}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 border px-4 py-3 text-left transition-colors",
                      o.id === offer.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {o.seller.store_name}
                        {o.seller.verification_level !== "BASIC" && (
                          <ShieldCheck className="size-3.5 text-success" />
                        )}
                      </span>
                      <span className="type-caption block truncate">
                        {o.seller.district}
                        {o.delivery_days != null && ` · ${o.delivery_days} kun`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="type-price block">{formatSom(o.price)}</span>
                      <span className="type-caption">
                        {o.available} {t("common.pcs")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* quantity + actions */}
          <div className="mt-6 flex items-center gap-3">
            <div className="inline-flex items-center border border-border">
              <button
                type="button"
                aria-label="Kamaytirish"
                className="px-4 py-2.5 text-lg"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="w-10 text-center text-sm font-bold">{qty}</span>
              <button
                type="button"
                aria-label="Ko'paytirish"
                className="px-4 py-2.5 text-lg disabled:opacity-40"
                disabled={qty >= maxQty}
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              >
                +
              </button>
            </div>
            <span className="type-caption">
              {offer.available > 0
                ? `${t("common.inStock")} · ${offer.available} ${t("common.pcs")}`
                : t("common.outOfStock")}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={offer.available <= 0 || addToCart.isPending}
              onClick={() =>
                addToCart.mutate(
                  { offer_id: offer.id, quantity: qty },
                  {
                    onSuccess: () => toast.success(t("common.addToCart"), { description: name }),
                    onError: (e) => toast.error((e as Error).message),
                  },
                )
              }
              className="inline-flex items-center justify-center gap-2 bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {addToCart.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShoppingBag className="size-4" />
              )}
              {t("common.addToCart")}
            </button>
            <button
              type="button"
              disabled={offer.available <= 0 || addToCart.isPending}
              onClick={() =>
                addToCart.mutate(
                  { offer_id: offer.id, quantity: qty },
                  {
                    onSuccess: () => void navigate({ to: "/cart" }),
                    onError: (e) => toast.error((e as Error).message),
                  },
                )
              }
              className="border border-border-strong bg-card px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("common.buyNow")}
            </button>
          </div>

          {/* trust row */}
          <div className="mt-8 divide-y divide-border border-y border-border">
            <Row
              icon={PackageCheck}
              title={offer.available > 0 ? t("common.inStock") : t("common.outOfStock")}
              sub={`${offer.seller.store_name} · ${offer.seller.district}`}
            />
            <Row
              icon={Truck}
              title={t("common.delivery")}
              sub={
                offer.delivery_days != null
                  ? `Toshkent bo'ylab ${offer.delivery_days} kun`
                  : "Kelishilgan holda"
              }
            />
            <Row
              icon={ShieldCheck}
              title={t("common.warranty")}
              sub={
                (offer.warranty_months ?? data.warranty_months)
                  ? `${offer.warranty_months ?? data.warranty_months} ${t("common.months")}`
                  : "Sotuvchi kafolati"
              }
            />
          </div>
        </section>
      </div>
    </Page>
  );
}

function Row({ icon: Icon, title, sub }: { icon: typeof Truck; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <Icon className="size-5 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="type-caption">{sub}</p>
      </div>
    </div>
  );
}
