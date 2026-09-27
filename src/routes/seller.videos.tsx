/**
 * Videolar — the store's own clips.
 *
 * The screen exists to answer one question the seller keeps asking: *why is my
 * video not in the feed?* So every card carries both status badges and, under
 * them, the server's own list of what is still missing — file not ready, not
 * yet approved, not yet published. "Ko'rib chiqilmoqda" is spelled out rather
 * than left as a badge, because it is the state people read as "live".
 */
import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BarChart3, Info, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/avtoqism/Page";
import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { VideoForm } from "@/components/avtoqism/creator/VideoForm";
import {
  MODERATION_UZ,
  VIDEO_STATUS_UZ,
  moderationMeaning,
} from "@/components/avtoqism/creator/status";
import { PanelSection, PanelToolbar } from "@/components/avtoqism/panel/PanelShell";
import { useSellerScope } from "@/components/avtoqism/panel/SellerContext";
import { Button, Pill } from "@/components/avtoqism/panel/Widgets";
import { formatDate, groupDigits } from "@/lib/format";
import type { CreatorVideoCard } from "@/lib/query/seller";
import {
  useDeleteVideo,
  usePublishVideo,
  useSellerVideo,
  useSellerVideos,
} from "@/lib/query/seller";

export const Route = createFileRoute("/seller/videos")({
  head: () => ({
    meta: [{ title: "Videolar — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: SellerVideos,
});

function SellerVideos() {
  const { seller } = useSellerScope();
  const sellerId = seller.id;

  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const grid = useSellerVideos(sellerId, page);
  const editing = useSellerVideo(sellerId, editingId);
  const publish = usePublishVideo(sellerId);
  const remove = useDeleteVideo(sellerId);

  const items = grid.data?.items ?? [];
  const formOpen = creating || editingId !== null;

  function closeForm() {
    setCreating(false);
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      <PanelToolbar>
        <Button onClick={() => setCreating(true)} disabled={formOpen}>
          <Plus className="size-4" aria-hidden />
          Video qo'shish
        </Button>
        <span className="ml-auto">
          <Link
            to="/seller/feed"
            className="inline-flex items-center gap-2 border border-border-strong bg-card px-3 py-2 text-xs font-semibold"
          >
            <BarChart3 className="size-4" aria-hidden />
            Statistika
          </Link>
        </span>
      </PanelToolbar>

      <div className="flex gap-3 border border-border bg-card px-5 py-4">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="type-caption">
          Video lentaga uch shart bajarilgandan keyin chiqadi: fayl tayyor bo'lishi, administrator
          tasdiqlashi va sizning e'lon qilishingiz. «Ko'rib chiqilmoqda» — bu video hali hech kimga
          ko'rinmayotganini bildiradi.
        </p>
      </div>

      {formOpen && (
        <PanelSection
          title={editingId ? "Videoni tahrirlash" : "Yangi video"}
          action={
            <Button variant="ghost" size="sm" onClick={closeForm}>
              Yopish
            </Button>
          }
        >
          <div className="p-5">
            {editingId ? (
              editing.isPending ? (
                <LineSkeleton className="h-40 w-full" />
              ) : editing.isError ? (
                <ErrorState error={editing.error} onRetry={() => void editing.refetch()} compact />
              ) : (
                <VideoForm
                  key={editing.data.id}
                  sellerId={sellerId}
                  video={editing.data}
                  defaultRegion={seller.region}
                  onDone={closeForm}
                />
              )
            ) : (
              <VideoForm
                sellerId={sellerId}
                video={null}
                defaultRegion={seller.region}
                onDone={closeForm}
              />
            )}
          </div>
        </PanelSection>
      )}

      {grid.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="border border-border bg-card p-4">
              <LineSkeleton className="mb-3 h-48 w-full" />
              <LineSkeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : grid.isError ? (
        <ErrorState error={grid.error} onRetry={() => void grid.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Hali video yo'q"
          subtitle="Qisqa video — mahsulotni ishlayotgan holda ko'rsatishning eng tez yo'li. MP4 yoki MOV yuklang, mahsulotlaringizni belgilang va e'lon qiling."
          action={
            <Button onClick={() => setCreating(true)} disabled={formOpen}>
              <Plus className="size-4" aria-hidden />
              Birinchi videoni joylash
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                busy={
                  (publish.isPending && publish.variables === clip.id) ||
                  (remove.isPending && remove.variables === clip.id)
                }
                error={
                  (publish.isError && publish.variables === clip.id && publish.error.message) ||
                  (remove.isError && remove.variables === clip.id && remove.error.message) ||
                  null
                }
                onEdit={() => {
                  setCreating(false);
                  setEditingId(clip.id);
                }}
                onPublish={() => publish.mutate(clip.id)}
                onRemove={() => remove.mutate(clip.id)}
              />
            ))}
          </div>

          {(page > 1 || grid.data.has_more) && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                Oldingi
              </Button>
              <span className="type-caption">
                {groupDigits(grid.data.total)} ta video · {page}-sahifa
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!grid.data.has_more}
                onClick={() => setPage((current) => current + 1)}
              >
                Keyingi
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClipCard({
  clip,
  busy,
  error,
  onEdit,
  onPublish,
  onRemove,
}: {
  clip: CreatorVideoCard;
  busy: boolean;
  error: string | null;
  onEdit: () => void;
  onPublish: () => void;
  onRemove: () => void;
}) {
  const status = clip.status ? VIDEO_STATUS_UZ[clip.status] : null;
  const moderation = clip.moderation_status ? MODERATION_UZ[clip.moderation_status] : null;
  const removed = clip.status === "REMOVED";

  return (
    <article className="flex flex-col border border-border bg-card">
      <div className="aspect-[9/16] max-h-80 bg-muted">
        {clip.playback_url ? (
          // The seller's own clip, so it plays here rather than only on the
          // feed: checking that the right file was uploaded is the first thing
          // anyone does after an upload.
          <video
            src={clip.playback_url}
            poster={clip.thumbnail_url ?? undefined}
            controls
            preload="metadata"
            className="size-full object-cover"
          />
        ) : clip.thumbnail_url ? (
          <img src={clip.thumbnail_url} alt="" className="size-full object-cover" loading="lazy" />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {clip.is_public ? (
            <Pill tone="good">Lentada</Pill>
          ) : (
            <Pill tone="warning">Lentada emas</Pill>
          )}
          {moderation && <Pill tone={moderation.tone}>{moderation.label}</Pill>}
          {status && status.tone !== "good" && <Pill tone={status.tone}>{status.label}</Pill>}
        </div>

        <p className="line-clamp-2 text-sm font-medium">
          {clip.caption?.trim() || "Sarlavhasiz video"}
        </p>

        {clip.moderation_status && !clip.is_public && (
          <p className="type-caption">{moderationMeaning(clip.moderation_status)}</p>
        )}

        <p className="type-caption">
          {groupDigits(clip.view_count)} ko'rish · {groupDigits(clip.like_count)} layk ·{" "}
          {groupDigits(clip.comment_count)} komment
        </p>
        <p className="type-caption">
          {clip.published_at
            ? `E'lon qilingan: ${formatDate(clip.published_at)}`
            : "Hali e'lon qilinmagan"}
        </p>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onEdit} disabled={busy || removed}>
            <Pencil className="size-3.5" aria-hidden />
            Tahrirlash
          </Button>
          {!clip.published_at && (
            <Button size="sm" onClick={onPublish} disabled={busy || removed}>
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="size-3.5" aria-hidden />
              )}
              E'lon qilish
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={onRemove}
            disabled={busy || removed}
            className="ml-auto"
          >
            <Trash2 className="size-3.5" aria-hidden />
            O'chirish
          </Button>
        </div>
      </div>
    </article>
  );
}
