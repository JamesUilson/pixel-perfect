/**
 * Video moderatsiyasi — the queue the feed waits on.
 *
 * A clip is invisible until someone here approves it, so the queue is ordered
 * by the server with the already-published ones first: those are sellers
 * waiting, not drafts. Each card shows the clip itself, because a caption is
 * not what is being moderated.
 *
 * A rejection needs a reason and the server refuses one without it. The reason
 * is written to the audit log and to nothing the seller can read, which is said
 * plainly beside the field rather than papered over with a promise this API
 * cannot keep.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2, X } from "lucide-react";

import { EmptyState } from "@/components/avtoqism/Page";
import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { MODERATION_UZ } from "@/components/avtoqism/creator/status";
import { PanelSection, PanelToolbar } from "@/components/avtoqism/panel/PanelShell";
import { Button, Pill, inputClass } from "@/components/avtoqism/panel/Widgets";
import { formatDateTime, groupDigits } from "@/lib/format";
import type { PendingVideoRow } from "@/lib/query/admin";
import { useAdminPendingVideos, useModerateVideo } from "@/lib/query/admin";
import type { VideoModerationStatus } from "@/lib/query/seller";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/videos")({
  head: () => ({
    meta: [{ title: "Videolar — AVTOQISM admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminVideos,
});

const PER_PAGE = 20;

function AdminVideos() {
  const [offset, setOffset] = useState(0);
  const queue = useAdminPendingVideos(PER_PAGE, offset);
  const moderate = useModerateVideo();

  const items = queue.data?.items ?? [];
  const total = queue.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PanelToolbar>
        <span className="type-label text-muted-foreground">
          Navbatda {groupDigits(total)} ta video
        </span>
      </PanelToolbar>

      {queue.isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <LineSkeleton key={index} className="h-56 w-full" />
          ))}
        </div>
      ) : queue.isError ? (
        <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Navbat bo'sh"
          subtitle="Tekshiruvni kutayotgan video yo'q. Yangi video kelganda shu yerda paydo bo'ladi."
        />
      ) : (
        <>
          <div className="space-y-4">
            {items.map((row) => (
              <QueueCard
                key={row.id}
                row={row}
                busy={moderate.isPending && moderate.variables?.videoId === row.id}
                error={
                  moderate.isError && moderate.variables?.videoId === row.id
                    ? moderate.error.message
                    : null
                }
                onDecide={(approved, reason) =>
                  moderate.mutate({
                    videoId: row.id,
                    approved,
                    ...(reason ? { reason } : {}),
                  })
                }
              />
            ))}
          </div>

          {(offset > 0 || offset + items.length < total) && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={offset <= 0}
                onClick={() => setOffset((current) => Math.max(current - PER_PAGE, 0))}
              >
                Oldingi
              </Button>
              <span className="type-caption">
                {groupDigits(offset + 1)}–{groupDigits(offset + items.length)} /{" "}
                {groupDigits(total)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + items.length >= total}
                onClick={() => setOffset((current) => current + PER_PAGE)}
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

function QueueCard({
  row,
  busy,
  error,
  onDecide,
}: {
  row: PendingVideoRow;
  busy: boolean;
  error: string | null;
  onDecide: (approved: boolean, reason: string | null) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const moderation = MODERATION_UZ[row.moderation_status as VideoModerationStatus] ?? null;
  const trimmed = reason.trim();

  return (
    <PanelSection
      title={row.store_name ?? "Do'kon ko'rsatilmagan"}
      subtitle={row.handle ? `@${row.handle}` : undefined}
      action={
        <div className="flex flex-wrap items-center gap-1.5">
          {row.waiting_in_feed ? (
            <Pill tone="warning">Sotuvchi e'lon qilgan</Pill>
          ) : (
            <Pill tone="neutral">Qoralama</Pill>
          )}
          {moderation && <Pill tone={moderation.tone}>{moderation.label}</Pill>}
        </div>
      }
    >
      <div className="grid gap-5 p-5 md:grid-cols-[220px_1fr]">
        <div className="aspect-[9/16] max-h-72 bg-muted">
          {row.playback_url ? (
            <video
              src={row.playback_url}
              poster={row.thumbnail_url ?? undefined}
              controls
              preload="metadata"
              className="size-full object-contain"
            />
          ) : row.thumbnail_url ? (
            <img src={row.thumbnail_url} alt="" className="size-full object-cover" />
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          <p className="whitespace-pre-line text-sm">
            {row.caption?.trim() || <span className="text-muted-foreground">Sarlavhasiz</span>}
          </p>

          {row.hashtags.length > 0 && (
            <p className="text-xs text-primary">{row.hashtags.map((tag) => `#${tag}`).join(" ")}</p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div>
              <dt className="inline">Mintaqa: </dt>
              <dd className="inline">{row.region ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline">Davomiyligi: </dt>
              <dd className="inline">{row.duration_seconds ? `${row.duration_seconds} s` : "—"}</dd>
            </div>
            <div>
              <dt className="inline">Yuklangan: </dt>
              <dd className="inline">{formatDateTime(row.created_at)}</dd>
            </div>
            <div>
              <dt className="inline">E'lon qilingan: </dt>
              <dd className="inline">
                {row.published_at ? formatDateTime(row.published_at) : "—"}
              </dd>
            </div>
          </dl>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {rejecting ? (
            <div className="space-y-2">
              <label
                className="type-label block text-muted-foreground"
                htmlFor={`reason-${row.id}`}
              >
                Rad etish sababi
              </label>
              <textarea
                id={`reason-${row.id}`}
                className={cn(inputClass, "min-h-20 resize-y")}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Nima uchun rad etilmoqda?"
              />
              <p className="type-caption">
                Sabab audit jurnaliga yoziladi. Hozircha sotuvchi uni o'z panelida ko'ra olmaydi —
                kerak bo'lsa, u bilan alohida bog'laning.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy || trimmed.length === 0}
                  onClick={() => onDecide(false, trimmed)}
                >
                  {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                  Rad etishni tasdiqlash
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
                  Bekor qilish
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => onDecide(true, null)}>
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-3.5" aria-hidden />
                )}
                Tasdiqlash
              </Button>
              <Button variant="danger" size="sm" disabled={busy} onClick={() => setRejecting(true)}>
                <X className="size-3.5" aria-hidden />
                Rad etish
              </Button>
            </div>
          )}
        </div>
      </div>
    </PanelSection>
  );
}
