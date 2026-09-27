import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/avtoqism/States";
import { ActionRail } from "@/components/avtoqism/feed/ActionRail";
import { CommentsSheet } from "@/components/avtoqism/feed/CommentsSheet";
import { ShareSheet } from "@/components/avtoqism/feed/ShareSheet";
import { StoreRow } from "@/components/avtoqism/feed/StoreRow";
import { TaggedProductCard } from "@/components/avtoqism/feed/TaggedProduct";
import { VideoMenu } from "@/components/avtoqism/feed/VideoMenu";
import { VideoStage } from "@/components/avtoqism/feed/VideoStage";
import { splitCaption, timeAgoUz } from "@/components/avtoqism/feed/util";
import { useVideoActions } from "@/components/avtoqism/feed/useVideoActions";
import { formatCompact } from "@/lib/format";
import { useComments, useFeedVideo, useRecordView } from "@/lib/query/feed";

export const Route = createFileRoute("/feed/$videoId")({
  component: VideoDetail,
});

/**
 * One clip, opened from a link or from the scroller.
 *
 * The difference from the scroller is not decoration: this screen is where a
 * person who was *sent* a clip lands, so everything the scroller keeps one
 * swipe away — the whole product strip, the comments, the scrubber — is on the
 * page instead of behind a gesture they have no reason to know about.
 */
function VideoDetail() {
  const { videoId } = Route.useParams();
  const navigate = useNavigate();
  const query = useFeedVideo(videoId);
  const recordView = useRecordView();
  const [muted, setMuted] = useState(true);
  const [sheet, setSheet] = useState<"comments" | "share" | null>(null);

  const item = query.data ?? null;
  const actions = useVideoActions(item);

  // Comments are previewed inline, so the sheet opens onto a list the person
  // has already started reading rather than a spinner.
  const comments = useComments(videoId, "top", Boolean(item));
  const preview = comments.data?.pages[0]?.items.slice(0, 2) ?? [];

  if (query.isPending) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background px-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="aspect-[9/16] max-h-[55dvh] animate-pulse bg-muted" />
          <div className="h-4 w-2/3 animate-pulse bg-muted" />
          <div className="h-4 w-1/3 animate-pulse bg-muted" />
        </div>
      </div>
    );
  }

  if (query.isError || !item) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background px-6">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const { video, counters, seller, products } = item;
  const caption = splitCaption(video.caption);

  return (
    <div className="min-h-[100dvh] bg-background pb-24 text-foreground lg:pb-10">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-background/95 px-2 backdrop-blur-md">
        <button
          type="button"
          onClick={() => void navigate({ to: "/feed" })}
          aria-label="Orqaga"
          className="grid size-10 place-items-center text-foreground"
        >
          <ChevronLeft className="size-6" />
        </button>
        <VideoMenu item={item} onShare={() => setSheet("share")} />
      </header>

      <div className="relative mx-auto max-w-lg">
        <VideoStage
          video={video}
          active
          muted={muted}
          onMutedChange={setMuted}
          showProgress
          onWatched={(report) =>
            recordView.mutate({ videoId: video.id, ...report }, { onError: () => undefined })
          }
          className="aspect-[9/16] max-h-[68dvh] w-full"
        />
        <ActionRail
          item={item}
          onLike={actions.toggleLike}
          onComments={() => setSheet("comments")}
          onShare={() => setSheet("share")}
          onSave={actions.toggleSave}
          className="absolute bottom-4 right-3 z-20"
        />
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-4 pt-5">
        <div>
          <p className="text-base font-semibold">{caption.head}</p>
          {caption.rest && <p className="type-caption mt-1">{caption.rest}</p>}
          {video.published_at && (
            <p className="type-caption mt-2">{timeAgoUz(video.published_at)}</p>
          )}
        </div>

        {seller && (
          <StoreRow
            seller={seller}
            following={item.following}
            onToggleFollow={actions.toggleFollow}
            className="border-y border-border py-4"
          />
        )}

        {products.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Mahsulotlar</h2>
              {seller && (
                <Link
                  to="/marketplace"
                  search={{ q: seller.store_name }}
                  className="type-caption underline-offset-4 hover:underline"
                >
                  Barchasi
                </Link>
              )}
            </div>
            {/* A strip, not a grid: the clip tags a handful of parts, and a
                grid of three would leave a hole where the fourth is not. */}
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {products.map((product) => (
                <TaggedProductCard
                  key={product.product_id}
                  product={product}
                  className="w-64 shrink-0"
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <button
            type="button"
            onClick={() => setSheet("comments")}
            className="flex w-full items-baseline justify-between text-left"
          >
            <h2 className="text-sm font-semibold">Kommentariyalar</h2>
            <span className="type-caption">{formatCompact(counters.comment_count)}</span>
          </button>

          {preview.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {preview.map((comment) => (
                <li key={comment.id} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-bold">
                    {(comment.author.full_name ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                  <p className="min-w-0 text-sm">
                    <span className="font-semibold">{comment.author.full_name}</span>{" "}
                    <span className="text-muted-foreground">{comment.body}</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-caption mt-3">Hali kommentariya yo'q. Birinchi bo'ling.</p>
          )}

          {/* Not an input: a real one here would be a second composer competing
              with the sheet's, and two drafts of the same comment is a way to
              lose one of them. */}
          <button
            type="button"
            onClick={() => setSheet("comments")}
            className="mt-4 w-full border border-border px-4 py-3 text-left text-sm text-muted-foreground"
          >
            Kommentariy yozing…
          </button>
        </section>
      </div>

      <CommentsSheet
        item={item}
        open={sheet === "comments"}
        onOpenChange={(open) => setSheet(open ? "comments" : null)}
      />
      <ShareSheet
        item={item}
        open={sheet === "share"}
        onOpenChange={(open) => setSheet(open ? "share" : null)}
        onSave={actions.toggleSave}
        onReport={() => undefined}
      />
    </div>
  );
}
