import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bookmark,
  Check,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Play,
  Send,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import feedPoster from "@/assets/part-wheel.jpg";
import { Brand } from "@/components/avtoqism/Chrome";
import { ErrorState } from "@/components/avtoqism/States";
import { formatCompact, formatSom } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { useProducts } from "@/lib/query/catalog";
import { useAddToCart } from "@/lib/query/commerce";
import { useActiveVehicle } from "@/lib/query/garage";
import { useUiState } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Feed — AVTOQISM" },
      {
        name: "description",
        content: "O'zbekiston avtomobil ishqibozlari uchun videolar va mos mahsulotlar.",
      },
      { property: "og:title", content: "Feed — AVTOQISM" },
    ],
  }),
  component: Feed,
});

/**
 * Social feed.
 *
 * The video pipeline (upload → transcode → CDN) lands in a later phase, so the
 * clip surface is still a poster. Everything commerce-side is already live: the
 * tagged product is fetched from the API, its price, stock and compatibility
 * come from the server, and "add to cart" goes through the same endpoint as the
 * marketplace — which is the loop that has to work.
 */
function Feed() {
  const t = useT();
  const { lang } = useLang();
  const { likes, follows, toggleLike, toggleFollow } = useUiState();
  const { variantId } = useActiveVehicle();
  const addToCart = useAddToCart();

  // Until the video endpoints exist, the feed is seeded from real catalogue
  // items so every product tag is genuine rather than a hardcoded price.
  const products = useProducts({ sort: "popular", size: 6 });
  const [index, setIndex] = useState(0);

  if (products.isError) {
    return (
      <div className="min-h-screen bg-feed p-6 text-feed-foreground">
        <ErrorState error={products.error} onRetry={() => void products.refetch()} />
      </div>
    );
  }

  const items = products.data?.items ?? [];
  const current = items[index % Math.max(items.length, 1)];
  const liked = current ? likes.includes(current.id) : false;
  const saved = current ? follows.includes(current.id) : false;

  return (
    <div className="min-h-screen bg-feed text-feed-foreground">
      <main className="relative mx-auto min-h-screen max-w-[1440px] overflow-hidden pb-20 md:grid md:grid-cols-[minmax(0,1fr)_400px] md:pb-0">
        <header className="absolute inset-x-0 top-0 z-20 flex h-20 items-center justify-between px-5 md:px-8">
          <Brand inverse />
          <div className="flex items-center gap-5">
            <span className="border-b-2 border-primary pb-2 text-sm font-semibold">
              {t("feed.forYou")}
            </span>
            <Link
              to="/marketplace"
              className="pb-2 text-sm text-feed-muted hover:text-feed-foreground"
            >
              {t("nav.market")}
            </Link>
            <button type="button" aria-label="Ko'proq" className="text-feed-foreground">
              <MoreHorizontal className="size-5" />
            </button>
          </div>
        </header>

        {/* --- clip surface -------------------------------------------------- */}
        <section className="relative min-h-[calc(100vh-5rem)] md:min-h-screen">
          <img
            src={current?.image_url ?? feedPoster}
            alt={current?.name_uz ?? ""}
            className="absolute inset-0 size-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-feed via-feed/20 to-feed/40" />

          <button
            type="button"
            aria-label="Keyingi video"
            onClick={() => setIndex((i) => i + 1)}
            className="absolute inset-0 m-auto grid size-16 place-items-center rounded-full border border-feed-border bg-feed/30 text-feed-foreground backdrop-blur-sm"
          >
            <Play className="ml-1 size-6 fill-current" />
          </button>

          <button
            type="button"
            aria-label="Ovoz"
            className="absolute right-5 top-24 grid size-10 place-items-center rounded-full bg-feed/45 backdrop-blur-sm md:right-8"
          >
            <Volume2 className="size-5" />
          </button>

          {current && (
            <div className="absolute bottom-40 left-5 right-16 z-10 md:bottom-10 md:left-8 md:right-24">
              <div className="max-w-xl">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-feed-foreground text-xs font-bold text-feed">
                    {current.best_offer.seller.store_name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{current.best_offer.seller.store_name}</p>
                    <p className="text-xs text-feed-muted">
                      {current.best_offer.seller.district}, {current.best_offer.seller.region}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFollow(current.best_offer.seller.id)}
                    className={cn(
                      "ml-2 border px-3 py-1.5 text-xs font-semibold transition-colors",
                      follows.includes(current.best_offer.seller.id)
                        ? "border-feed-border text-feed-muted"
                        : "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {follows.includes(current.best_offer.seller.id)
                      ? t("feed.following")
                      : t("feed.follow")}
                  </button>
                </div>

                <p className="mt-5 text-base font-medium leading-relaxed md:text-lg">
                  {(lang === "uz" ? current.name_uz : current.name_ru) ?? current.name_uz}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-feed-muted md:text-sm">
                  <span>#avtoqism</span>
                  <span>#toshkent</span>
                  {current.brand_name && <span>#{current.brand_name.toLowerCase()}</span>}
                </div>
              </div>
            </div>
          )}

          {/* social rail */}
          {current && (
            <div className="absolute bottom-40 right-5 z-20 flex flex-col gap-5 md:bottom-10 md:right-8">
              <RailButton
                icon={Heart}
                active={liked}
                label={formatCompact(1200 + index * 137)}
                onClick={() => toggleLike(current.id)}
              />
              <RailButton
                icon={MessageCircle}
                label={formatCompact(48 + index * 7)}
                onClick={() => {}}
              />
              <RailButton icon={Send} label="Ulashish" onClick={() => {}} />
              <RailButton
                icon={Bookmark}
                active={saved}
                label="Saqlash"
                onClick={() => toggleFollow(current.id)}
              />
            </div>
          )}
        </section>

        {/* --- tagged product, live from the API ----------------------------- */}
        <aside className="hidden border-l border-feed-border bg-feed p-8 md:flex md:flex-col md:justify-end">
          {products.isPending ? (
            <div className="space-y-4">
              <div className="aspect-[4/3] animate-pulse bg-white/10" />
              <div className="h-6 w-2/3 animate-pulse bg-white/10" />
              <div className="h-6 w-1/3 animate-pulse bg-white/10" />
            </div>
          ) : current ? (
            <>
              <p className="type-label text-feed-muted">Videodagi mahsulot</p>
              <Link
                to="/product/$productId"
                params={{ productId: current.slug }}
                className="mt-5 block aspect-[4/3] overflow-hidden bg-white/5"
              >
                {current.image_url && (
                  <img
                    src={current.image_url}
                    alt=""
                    className="image-zoom size-full object-cover"
                  />
                )}
              </Link>
              <h1 className="mt-6 font-display text-2xl font-semibold">
                {(lang === "uz" ? current.name_uz : current.name_ru) ?? current.name_uz}
              </h1>
              <p className="mt-2 text-xl font-semibold">{formatSom(current.best_offer.price)}</p>

              {current.compatibility && variantId && (
                <div className="mt-5 flex items-center gap-3 border-y border-feed-border py-4">
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full",
                      current.compatibility.status === "COMPATIBLE" ? "bg-success" : "bg-white/20",
                    )}
                  >
                    <Check className="size-4" />
                  </span>
                  <div>
                    <p className="type-label text-success">
                      {current.compatibility.status === "COMPATIBLE"
                        ? t("fit.short")
                        : t("fit.check")}
                    </p>
                    <p className="mt-1 text-sm text-feed-muted">
                      {t(`fit.source.${current.compatibility.source}`)}
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={current.best_offer.available <= 0 || addToCart.isPending}
                onClick={() =>
                  addToCart.mutate(
                    { offer_id: current.best_offer.id, quantity: 1 },
                    {
                      onSuccess: () => toast.success(t("common.addToCart")),
                      onError: (e) => toast.error((e as Error).message),
                    },
                  )
                }
                className="mt-6 w-full bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {t("common.addToCart")}
              </button>
              <Link
                to="/product/$productId"
                params={{ productId: current.slug }}
                className="mt-3 block w-full border border-feed-border px-5 py-3 text-center text-sm font-semibold"
              >
                {t("feed.shop")}
              </Link>
            </>
          ) : null}
        </aside>

        {/* mobile product strip */}
        {current && (
          <Link
            to="/product/$productId"
            params={{ productId: current.slug }}
            className="absolute bottom-24 left-5 right-20 z-30 flex items-center gap-3 border border-feed-border bg-feed/70 p-3 backdrop-blur-md md:hidden"
          >
            {current.image_url && (
              <img src={current.image_url} alt="" className="size-14 shrink-0 object-cover" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{current.name_uz}</p>
              <p className="text-xs text-feed-muted">{formatSom(current.best_offer.price)}</p>
            </div>
          </Link>
        )}
      </main>

      {/* feed keeps its own bottom bar so the dark surface is unbroken */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-feed-border bg-feed/95 px-2 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md md:hidden">
        {(
          [
            { to: "/", label: t("nav.home") },
            { to: "/marketplace", label: t("nav.market") },
            { to: "/feed", label: t("nav.feed") },
            { to: "/garage", label: t("nav.garage") },
          ] as const
        ).map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            className="flex min-h-11 items-center justify-center text-[11px] font-semibold text-feed-muted"
            activeProps={{
              className:
                "flex min-h-11 items-center justify-center text-[11px] font-semibold text-primary",
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: typeof Heart;
  label: string;
  active?: boolean | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-[10px] font-semibold text-feed-foreground"
    >
      <span className="grid size-11 place-items-center rounded-full bg-feed/45 backdrop-blur-sm">
        <Icon className={cn("size-5", active && "fill-primary text-primary")} />
      </span>
      {label}
    </button>
  );
}
