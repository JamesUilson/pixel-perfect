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
 * Which clip is "the" clip is decided by an IntersectionObserver rather than
 * by scroll arithmetic: the browser already knows what is on screen, and
 * snapping is CSS, so there is no carousel index to keep in step with it.
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

  return (
    <section
      ref={slideRef}
      data-video-id={videoId}
      className="relative h-[100dvh] w-full shrink-0 snap-start snap-always"
      aria-label={item.video.caption ?? "Video"}
    >
      <VideoStage
        video={item.video}
        active={active}
        muted={muted}
        onMutedChange={onMutedChange}
        onWatched={(report) => recordView.mutate({ videoId, ...report })}
        className="absolute inset-0 size-full"
      />

      <ActionRail
        item={item}
        onLike={toggleLike}
        onSave={toggleSave}
        onComments={onOpenComments}
        onShare={onOpenShare}
        className="absolute bottom-52 right-4 z-20 lg:bottom-28"
      />

      <div className="absolute inset-x-0 bottom-0 z-10 space-y-3 px-4 pb-24 lg:pb-8">
        <div className="max-w-xl pr-16">
          {item.seller ? (
            <StoreRow
              seller={item.seller}
              following={item.following}
              onToggleFollow={toggleFollow}
            />
          ) : (
            <p className="text-sm font-semibold">{item.author.full_name ?? "AVTOQISM"}</p>
          )}

          {item.video.caption && (
            <Link
              to="/feed/$videoId"
              params={{ videoId }}
              className="mt-4 block text-base font-medium leading-relaxed"
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
    </section>
  );
}
