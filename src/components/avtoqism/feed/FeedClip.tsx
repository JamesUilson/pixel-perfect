import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { ActionRail } from "./ActionRail";
import { StoreRow } from "./StoreRow";
import { TaggedProductCard } from "./TaggedProduct";
import { VideoStage } from "./VideoStage";
import { useVideoActions } from "./useVideoActions";
import { useRecordView, type FeedItem } from "@/lib/query/feed";

type Props = {
  item: FeedItem;
  active: boolean;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  onVisible: (videoId: string) => void;
  onOpenComments: () => void;
  onOpenShare: () => void;
};

/** How much of a clip has to be on screen before it counts as the one being watched. */
const ACTIVE_THRESHOLD = 0.6;

/**
 * One full-height slide of the scroller.
 *
 * Two layouts, one component.
 *
 * On a phone the clip is the screen: full bleed, with the rail and the caption
 * over it. On a wide screen it is a centred 9:16 column at the height of the
 * viewport, with the rail standing outside it — because a portrait clip
 * stretched across a 1440px monitor is either enormous or letterboxed into a
 * grey field, and neither is what anyone means by "watch a reel on the web".
 * The column is capped by height rather than width so the clip fills the
 * screen top to bottom on a laptop and does not overflow a short window.
 */
export function FeedClip({
  item,
  active,
  muted,
  onMutedChange,
  onVisible,
  onOpenComments,
  onOpenShare,
}: Props) {
  const slideRef = useRef<HTMLElement | null>(null);
  const recordView = useRecordView();
  const { toggleLike, toggleSave, toggleFollow } = useVideoActions(item);

  const videoId = item.video.id;
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    const element = slideRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.intersectionRatio >= ACTIVE_THRESHOLD) onVisibleRef.current(videoId);
      },
      { threshold: [0, ACTIVE_THRESHOLD, 1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [videoId]);

  const product = item.products[0];

  const overlay = (
    <div className="absolute inset-x-0 bottom-0 z-10 space-y-3 px-4 pb-24 lg:pb-6">
      <div className="max-w-xl pr-14 lg:pr-0">
        {item.seller ? (
          <StoreRow seller={item.seller} following={item.following} onToggleFollow={toggleFollow} />
        ) : (
          <p className="text-sm font-semibold">{item.author.full_name ?? "AVTOQISM"}</p>
        )}

        {item.video.caption && (
          <Link
            to="/feed/$videoId"
            params={{ videoId }}
            className="mt-3 block text-sm font-medium leading-relaxed lg:text-base"
          >
            {item.video.caption}
          </Link>
        )}

        {item.video.hashtags.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {item.video.hashtags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </p>
        )}
      </div>

      {product && <TaggedProductCard product={product} className="max-w-xl" />}
    </div>
  );

  const rail = (
    <ActionRail
      item={item}
      onLike={toggleLike}
      onSave={toggleSave}
      onComments={onOpenComments}
      onShare={onOpenShare}
    />
  );

  return (
    <section
      ref={slideRef}
      data-video-id={videoId}
      className="relative flex h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center gap-4 lg:gap-5 lg:px-6"
      aria-label={item.video.caption ?? "Video"}
    >
      {/* The clip. Full bleed below lg; a height-capped 9:16 column above it. */}
      <div className="relative size-full lg:aspect-[9/16] lg:h-[min(92dvh,900px)] lg:w-auto lg:overflow-hidden lg:rounded-xl">
        <VideoStage
          video={item.video}
          active={active}
          muted={muted}
          onMutedChange={onMutedChange}
          onWatched={(report) => recordView.mutate({ videoId, ...report })}
          className="absolute inset-0 size-full"
        />
        {overlay}
        {/* Over the clip on a phone, where there is nowhere else for it. */}
        <div className="absolute bottom-52 right-3 z-20 lg:hidden">{rail}</div>
      </div>

      {/* Beside the clip on a wide screen, the way a reel reads on the web. */}
      <div className="hidden shrink-0 self-end pb-10 lg:block">{rail}</div>
    </section>
  );
}
