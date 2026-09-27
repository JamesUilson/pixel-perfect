import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, ChevronLeft, Eye, Grid3x3, Play, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/avtoqism/States";
import { initialsOf } from "@/components/avtoqism/feed/util";
import { formatCompact, formatSom } from "@/lib/format";
import { type CreatorTab, useCreator, useCreatorGrid, useToggleFollow } from "@/lib/query/feed";
import { useIsAuthenticated } from "@/lib/query/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feed/creators/$handle")({
  component: CreatorProfile,
});

const TABS: { key: CreatorTab; label: string; icon: typeof Grid3x3 }[] = [
  { key: "videos", label: "Videolar", icon: Grid3x3 },
  { key: "products", label: "Mahsulotlar", icon: ShoppingBag },
  { key: "saved", label: "Saqlanganlar", icon: Play },
];

/**
 * A store as the feed shows it.
 *
 * The owner sees the same screen their visitors do, plus the switch to look at
 * it without their own affordances — which is the only honest way to check
 * what a stranger actually sees, rather than guessing from the editor.
 */
function CreatorProfile() {
  const { handle } = Route.useParams();
  const navigate = useNavigate();
  const signedIn = useIsAuthenticated();
  const [tab, setTab] = useState<CreatorTab>("videos");
  const [asVisitor, setAsVisitor] = useState(false);

  const profile = useCreator(handle);
  const follow = useToggleFollow();

  // The first tab's page arrives with the profile; the others are fetched when
  // they are opened, so an unopened tab costs nothing.
  const grid = useCreatorGrid(handle, tab, tab !== "videos");
  const firstPage = profile.data?.videos;
  const pages = grid.data?.pages;

  if (profile.isPending) {
    return (
      <div className="min-h-[100dvh] bg-background px-4 pt-16">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="size-20 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-48 animate-pulse bg-muted" />
          <div className="h-4 w-32 animate-pulse bg-muted" />
          <div className="grid grid-cols-3 gap-1 pt-4">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="aspect-[9/16] animate-pulse bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background px-6">
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </div>
    );
  }

  const store = profile.data;
  const owner = store.is_owner && !asVisitor;

  const items =
    tab === "videos" ? (firstPage?.items ?? []) : (pages?.flatMap((p) => p.items) ?? []);
  const products = tab === "products" ? (pages?.flatMap((p) => p.products) ?? []) : [];
  const loadingGrid = tab !== "videos" && grid.isPending;

  const toggleFollow = () => {
    if (!signedIn) {
      toast.error("Obuna bo'lish uchun tizimga kiring.", {
        action: { label: "Kirish", onClick: () => void navigate({ to: "/login" }) },
      });
      return;
    }
    follow.mutate(
      { sellerId: store.seller_id, following: store.is_following },
      {
        onSuccess: () => void profile.refetch(),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Amal bajarilmadi."),
      },
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24 text-foreground lg:pb-10">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-background/95 px-2 backdrop-blur-md">
        <button
          type="button"
          onClick={() => void navigate({ to: "/feed" })}
          aria-label="Orqaga"
          className="grid size-10 place-items-center"
        >
          <ChevronLeft className="size-6" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">@{store.handle}</p>
        {store.is_owner && (
          <button
            type="button"
            onClick={() => setAsVisitor((v) => !v)}
            className="px-3 py-2 text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            {asVisitor ? "Egasi ko'rinishi" : "Foydalanuvchi ko'rinishi"}
          </button>
        )}
      </header>

      {store.is_owner && asVisitor && (
        <p className="border-y border-border bg-muted/60 px-4 py-2.5 text-center text-xs font-semibold">
          Bu — mehmonlar ko'radigan ko'rinish. Boshqaruv tugmalari yashirilgan.
        </p>
      )}

      <div className="mx-auto max-w-2xl px-4 pt-5">
        <div className="flex items-start gap-4">
          <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-lg font-bold text-background">
            {store.avatar_url ? (
              <img src={store.avatar_url} alt="" className="size-full object-cover" />
            ) : (
              initialsOf(store.store_name)
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 text-lg font-bold">
              <span className="truncate">{store.store_name}</span>
              {store.is_verified && (
                <BadgeCheck
                  className="size-5 shrink-0 text-primary"
                  aria-label="Tasdiqlangan do'kon"
                />
              )}
            </h1>
            <p className="type-caption">@{store.handle}</p>

            <dl className="mt-3 flex gap-6">
              <Count label="Videolar" value={store.video_count} />
              <Count label="Obunachilar" value={store.follower_count} />
              <Count label="Kuzatilmoqda" value={store.following_count} />
            </dl>
          </div>
        </div>

        {store.facts.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {store.facts.map((fact) => (
              <li key={fact.key} className="flex items-start gap-2 text-sm">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {fact.text}
              </li>
            ))}
          </ul>
        )}

        {store.description_uz && <p className="mt-3 text-sm">{store.description_uz}</p>}

        <div className="mt-5 flex gap-2">
          {owner ? (
            <>
              <Link
                to="/seller/videos"
                className="flex-1 bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
              >
                Video joylash
              </Link>
              <Link
                to="/seller/feed"
                className="flex-1 border border-border px-4 py-3 text-center text-sm font-semibold"
              >
                Statistika
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleFollow}
                disabled={follow.isPending || asVisitor}
                aria-pressed={store.is_following}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60",
                  store.is_following
                    ? "border border-border"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {store.is_following ? "Obuna bo'lingan" : "Obuna bo'lish"}
              </button>
              {/* The design puts "Xabar" here. There is no messaging in this
                  product yet, and a button that does nothing is worse than one
                  that is absent — so the slot goes to the store's catalogue,
                  which is what a visitor is actually here to reach. */}
              <button
                type="button"
                onClick={() => setTab("products")}
                className="flex-1 border border-border px-4 py-3 text-center text-sm font-semibold"
              >
                Mahsulotlar
              </button>
            </>
          )}
        </div>
      </div>

      <nav className="mt-6 grid grid-cols-3 border-y border-border" aria-label="Do'kon bo'limlari">
        {TABS.filter((item) => item.key !== "saved" || store.is_owner).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-current={tab === item.key ? "page" : undefined}
            className={cn(
              "flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-colors",
              tab === item.key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mx-auto max-w-2xl px-1 pt-1">
        {loadingGrid ? (
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="aspect-[9/16] animate-pulse bg-muted" />
            ))}
          </div>
        ) : tab === "products" ? (
          products.length === 0 ? (
            <Empty text="Bu do'kon hali kliplarida mahsulot belgilamagan." />
          ) : (
            <ul className="grid grid-cols-2 gap-3 px-3 py-3 sm:grid-cols-3">
              {products.map((product) => (
                <li key={product.product_id}>
                  <Link to="/product/$productId" params={{ productId: product.slug }}>
                    <span className="block aspect-square overflow-hidden bg-muted">
                      {product.image_url && (
                        <img
                          src={product.image_url}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      )}
                    </span>
                    <span className="mt-2 block truncate text-sm font-semibold">
                      {product.name}
                    </span>
                    {product.price && (
                      <span className="type-caption block">{formatSom(product.price)}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : items.length === 0 ? (
          <Empty
            text={
              tab === "saved"
                ? "Saqlangan klip yo'q."
                : owner
                  ? "Hali klip joylamadingiz. Birinchisini joylang."
                  : "Bu do'kon hali klip joylamagan."
            }
          />
        ) : (
          <ul className="grid grid-cols-3 gap-1">
            {items.map((video) => (
              <li key={video.id} className="relative">
                <Link
                  to="/feed/$videoId"
                  params={{ videoId: video.id }}
                  className="block aspect-[9/16] overflow-hidden bg-muted"
                >
                  {video.thumbnail_url && (
                    <img
                      src={video.thumbnail_url}
                      alt={video.caption ?? ""}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  )}
                  <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[11px] font-semibold text-white drop-shadow">
                    <Eye className="size-3.5" aria-hidden />
                    {formatCompact(video.view_count)}
                  </span>
                  {/* The owner's grid includes clips nobody else can see yet,
                      so it has to say which ones those are. */}
                  {video.is_public === false && (
                    <span className="absolute left-1.5 top-1.5 bg-background/90 px-1.5 py-0.5 text-[10px] font-bold">
                      Ko'rib chiqilmoqda
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {tab !== "videos" && grid.hasNextPage && (
          <div className="py-6 text-center">
            <button
              type="button"
              onClick={() => void grid.fetchNextPage()}
              disabled={grid.isFetchingNextPage}
              className="border border-border px-5 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {grid.isFetchingNextPage ? "Yuklanmoqda…" : "Yana"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="text-base font-bold">{formatCompact(value)}</dd>
      <p className="type-caption">{label}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-6 py-16 text-center text-sm text-muted-foreground">{text}</p>;
}
