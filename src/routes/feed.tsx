import { Link, Outlet, createFileRoute, useChildMatches } from "@tanstack/react-router";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Brand } from "@/components/avtoqism/Chrome";
import { ErrorState } from "@/components/avtoqism/States";
import { CommentsSheet } from "@/components/avtoqism/feed/CommentsSheet";
import { FeedClip } from "@/components/avtoqism/feed/FeedClip";
import { ShareSheet } from "@/components/avtoqism/feed/ShareSheet";
import { VideoMenu } from "@/components/avtoqism/feed/VideoMenu";
import { useVideoActions } from "@/components/avtoqism/feed/useVideoActions";
import { useFeed } from "@/lib/query/feed";
import { useT } from "@/lib/i18n";

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
  component: FeedRoute,
});

/**
 * `/feed` is both a screen and the parent of `/feed/$videoId` and
 * `/feed/creators/$handle`. Those are full screens of their own rather than
 * panels inside the scroller, so the parent hands the whole surface over when
 * one of them is matched instead of framing it.
 */
function FeedRoute() {
  const children = useChildMatches();
  return children.length > 0 ? <Outlet /> : <FeedScroller />;
}

/** How close to the end of the loaded pages the next one starts loading. */
const PREFETCH_MARGIN = "800px";

function FeedScroller() {
  const t = useT();
  const feed = useFeed();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [sheet, setSheet] = useState<"comments" | "share" | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);

  // The first clip is the active one until the person scrolls.
  const firstId = items[0]?.video.id ?? null;
  useEffect(() => {
    setActiveId((current) => current ?? firstId);
  }, [firstId]);

  const current = items.find((item) => item.video.id === activeId) ?? items[0] ?? null;
  const actions = useVideoActions(current);

  /**
   * Move one clip. Scrolling by a slide and letting snap settle it keeps the
   * IntersectionObserver in charge of which clip is active — there is no index
   * to keep in step with the DOM, which is the bug every carousel has.
   */
  const step = useCallback((delta: 1 | -1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ top: delta * scroller.clientHeight, behavior: "smooth" });
  }, []);

  // A reel on a laptop is driven with the arrow keys, and the buttons below are
  // useless to anyone on a keyboard without this.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        step(-1);
      } else if (event.key.toLowerCase() === "m") {
        setMuted((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="relative min-h-[100dvh] bg-background text-foreground">
      <header className="absolute inset-x-0 top-0 z-30 flex h-16 items-center justify-between px-4 lg:px-8">
        <Brand />
        <div className="flex items-center gap-5">
          <span className="border-b-2 border-primary pb-1 text-sm font-semibold">
            {t("feed.forYou")}
          </span>
          <Link to="/marketplace" className="pb-1 text-sm text-muted-foreground">
            {t("nav.market")}
          </Link>
          {current ? (
            <VideoMenu item={current} onShare={() => setSheet("share")} />
          ) : (
            <span className="size-10" />
          )}
        </div>
      </header>

      {feed.isPending ? (
        <div className="grid h-[100dvh] place-items-center">
          <div className="w-full max-w-sm space-y-4 px-6">
            <div className="aspect-[9/16] max-h-[60dvh] animate-pulse bg-muted" />
            <div className="h-4 w-2/3 animate-pulse bg-muted" />
            <div className="h-4 w-1/3 animate-pulse bg-muted" />
          </div>
        </div>
      ) : feed.isError ? (
        <div className="grid h-[100dvh] place-items-center px-6">
          <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
        </div>
      ) : items.length === 0 ? (
        <div className="grid h-[100dvh] place-items-center px-6 text-center">
          <div>
            <h1 className="type-h2">Hali video yo'q</h1>
            <p className="type-caption mx-auto mt-3 max-w-xs">
              Do'konlar birinchi kliplarini joylashi bilan ular shu yerda ko'rinadi.
            </p>
            <Link
              to="/marketplace"
              className="mt-6 inline-flex bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              {t("nav.market")}
            </Link>
          </div>
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="h-[100dvh] snap-y snap-mandatory overflow-y-auto overscroll-y-contain no-scrollbar"
        >
          {items.map((item) => (
            <FeedClip
              key={item.video.id}
              item={item}
              active={item.video.id === activeId}
              muted={muted}
              onMutedChange={setMuted}
              onVisible={setActiveId}
              onOpenComments={() => setSheet("comments")}
              onOpenShare={() => setSheet("share")}
            />
          ))}

          <div ref={sentinelRef} aria-hidden className="h-px" />

          {isFetchingNextPage && (
            <p className="py-6 text-center text-sm text-muted-foreground">Yuklanmoqda…</p>
          )}
          {!hasNextPage && (
            <p className="snap-start py-10 text-center text-sm text-muted-foreground">
              Hozircha shuncha. Keyinroq qaytib keling.
            </p>
          )}
        </div>
      )}

      {/* Wide screens only: a phone is scrolled with a thumb, and a pair of
          buttons over the clip would just cover it. */}
      {items.length > 0 && (
        <div className="pointer-events-none absolute inset-y-0 right-6 z-30 hidden flex-col items-center justify-center gap-3 lg:flex">
          <StepButton label="Oldingi video" onClick={() => step(-1)}>
            <ChevronUp className="size-5" />
          </StepButton>
          <StepButton label="Keyingi video" onClick={() => step(1)}>
            <ChevronDown className="size-5" />
          </StepButton>
        </div>
      )}

      {current && (
        <>
          <CommentsSheet
            item={current}
            open={sheet === "comments"}
            onOpenChange={(open) => setSheet(open ? "comments" : null)}
          />
          <ShareSheet
            item={current}
            open={sheet === "share"}
            onOpenChange={(open) => setSheet(open ? "share" : null)}
            onSave={actions.toggleSave}
            onReport={() => undefined}
          />
        </>
      )}
    </div>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="pointer-events-auto grid size-11 place-items-center rounded-full border border-border bg-card/80 text-foreground backdrop-blur-md transition-colors hover:bg-card"
    >
      {children}
    </button>
  );
}
