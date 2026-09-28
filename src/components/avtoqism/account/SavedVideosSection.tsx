/**
 * "Saqlangan videolar" — the clips this person kept.
 *
 * The server filters the list to clips that are still publishable, so a tile
 * here always opens; a save that outlived its video is dropped rather than
 * returned as something that 404s on tap.
 *
 * Unsaving is the feed's own `useToggleVideoSave`, so the bookmark on the
 * scroller and the counter under the clip move with it. That mutation patches
 * the feed's caches and nothing else, so the tile is dropped from this list
 * here and the list refetched once the server has answered.
 */
import { Link } from "@tanstack/react-router";
import { BookmarkX, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { EmptyState, SectionHead } from "@/components/avtoqism/Page";
import { ErrorState } from "@/components/avtoqism/States";
import { ListPager } from "./ListPager";
import { formatCompact } from "@/lib/format";
import {
  SAVED_PAGE_SIZE,
  forgetSavedVideo,
  refreshSavedVideos,
  useSavedVideos,
  type SavedVideo,
} from "@/lib/query/discovery";
import { useToggleVideoSave } from "@/lib/query/feed";

export function SavedVideosSection() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const saved = useSavedVideos(page);
  const toggleSave = useToggleVideoSave();

  function unsave(videoId: string) {
    forgetSavedVideo(queryClient, videoId);
    toggleSave.mutate(
      { videoId, saved: true },
      {
        onError: () => toast.error("Olib tashlab bo'lmadi. Qayta urinib ko'ring."),
        onSettled: () => refreshSavedVideos(queryClient),
      },
    );
  }

  const data = saved.data;
  const rows = data?.items ?? [];

  return (
    <section>
      <SectionHead
        eyebrow="Feed"
        title="Saqlangan videolar"
        subtitle="Keyinroq ko'rish uchun belgilagan kliplaringiz."
      />

      {saved.isError ? (
        <ErrorState error={saved.error} onRetry={() => void saved.refetch()} compact />
      ) : saved.isPending ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="aspect-[9/16] animate-pulse bg-muted" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Saqlangan klip yo'q"
          subtitle="Lentada yoqqan klipni belgilab qo'ying — u shu yerda turadi va istalgan vaqtda qaytib ko'rasiz."
          action={
            <Link
              to="/feed"
              className="inline-flex bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Lentani ochish
            </Link>
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((row) => (
              <SavedTile key={row.video.id} row={row} onUnsave={() => unsave(row.video.id)} />
            ))}
          </ul>
          <ListPager
            page={data?.page ?? page}
            size={SAVED_PAGE_SIZE}
            total={data?.total ?? rows.length}
            pages={data?.pages ?? 1}
            busy={saved.isFetching}
            label="Saqlanganlar sahifalari"
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}

function SavedTile({ row, onUnsave }: { row: SavedVideo; onUnsave: () => void }) {
  const { video, store } = row;
  // A clip posted by a person rather than a shop has no store name; the caption
  // is what identifies it then, and "Klip" is the last resort rather than a
  // blank line under the tile.
  const title = store?.store_name ?? video.caption ?? "Klip";

  return (
    <li className="relative">
      <Link to="/feed/$videoId" params={{ videoId: video.id }} className="block">
        <span className="relative block aspect-[9/16] overflow-hidden bg-muted">
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
        </span>
        <span className="mt-2 block truncate text-sm font-semibold">{title}</span>
      </Link>

      {/*
       * A sibling of the link, not a child of it: a button inside an anchor is
       * a control a keyboard cannot reach and a screen reader announces as part
       * of the link.
       */}
      <button
        type="button"
        onClick={onUnsave}
        aria-label={`Saqlanganlardan olib tashlash: ${title}`}
        title="Saqlanganlardan olib tashlash"
        className="absolute right-1.5 top-1.5 grid size-9 place-items-center bg-background/90 text-foreground transition-colors hover:bg-background"
      >
        <BookmarkX className="size-4" aria-hidden />
      </button>
    </li>
  );
}
