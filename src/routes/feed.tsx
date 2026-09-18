import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Play, ShoppingBag } from "lucide-react";
import { Page, PageTitle } from "@/components/motora/Page";
import { getProduct, videos } from "@/data/demo";
import { formatCompact, formatSom } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Lenta — MOTORA" },
      {
        name: "description",
        content: "Avto ustalar va sotuvchilardan videolar — ko'ring va to'g'ridan-to'g'ri xarid qiling.",
      },
      { property: "og:title", content: "Lenta — MOTORA" },
      { property: "og:description", content: "Video ko'r, detalni darhol savatga qo'sh." },
    ],
  }),
  component: Feed,
});

function Feed() {
  const t = useT();
  const { lang } = useLang();
  const { likes, toggleLike, follows, toggleFollow } = useStore();

  return (
    <Page className="max-w-3xl">
      <PageTitle title={t("feed.title")} />
      <div className="space-y-6">
        {videos.map((v) => {
          const product = getProduct(v.productId);
          const liked = likes.includes(v.id);
          const following = follows.includes(v.authorId);
          return (
            <article key={v.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="type-h3 truncate">{v.authorName}</p>
                  <p className="type-caption">{v.district}, Toshkent</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFollow(v.authorId)}
                  className={cn(
                    "shrink-0 rounded-md border px-3 py-2 text-xs font-bold transition-colors",
                    following
                      ? "border-border text-muted-foreground"
                      : "border-accent-electric bg-accent-electric text-accent-electric-foreground",
                  )}
                >
                  {following ? t("feed.following") : t("feed.follow")}
                </button>
              </div>

              <div className="relative aspect-[4/5] bg-secondary sm:aspect-video">
                <img
                  src={v.poster}
                  alt={lang === "uz" ? v.titleUz : v.titleRu}
                  className="size-full object-cover"
                />
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-14 place-items-center rounded-full bg-background/80 backdrop-blur">
                    <Play className="size-6 fill-foreground" />
                  </span>
                </span>
              </div>

              <div className="p-4">
                <p className="type-h3">{lang === "uz" ? v.titleUz : v.titleRu}</p>
                <div className="mt-3 flex items-center gap-5">
                  <button
                    type="button"
                    onClick={() => toggleLike(v.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold"
                  >
                    <Heart
                      className={cn("size-5", liked && "fill-destructive text-destructive")}
                    />
                    {formatCompact(v.likes + (liked ? 1 : 0))}
                  </button>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                    <MessageCircle className="size-5" />
                    {formatCompact(v.comments)}
                  </span>
                </div>

                {product && (
                  <Link
                    to="/product/$productId"
                    params={{ productId: product.id }}
                    className="mt-4 flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-accent-electric"
                  >
                    <img
                      src={product.image}
                      alt=""
                      className="size-14 rounded-lg object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {lang === "uz" ? product.nameUz : product.nameRu}
                      </span>
                      <span className="type-price block">{formatSom(product.price)}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                      <ShoppingBag className="size-3.5" />
                      {t("feed.shop")}
                    </span>
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </Page>
  );
}
