import { useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Heart, SendHorizontal, Smile, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { initialsOf, timeAgoUz } from "./util";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { ErrorState } from "@/components/avtoqism/States";
import { formatCompact } from "@/lib/format";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useReplies,
  useToggleCommentLike,
  type CommentSort,
  type FeedComment,
  type FeedItem,
} from "@/lib/query/feed";
import { useMe } from "@/lib/query/auth";
import { useIsAuthenticated } from "@/lib/query/session";
import { cn } from "@/lib/utils";

type Props = {
  item: FeedItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * The comments sheet.
 *
 * The list call inlines the first two replies of every top-level comment, so a
 * thread is readable without a second request; "Yana N ta javobni ko'rish"
 * pages the rest, and the overlap with those first two is dropped rather than
 * shown twice.
 *
 * A deleted comment that still has replies stays in place with a placeholder
 * body — that is what the server sends, and removing it would orphan the
 * replies that answer it.
 */
export function CommentsSheet({ item, open, onOpenChange }: Props) {
  const videoId = item.video.id;
  const [sort, setSort] = useState<CommentSort>("new");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

  const comments = useComments(videoId, sort, open);
  const total = comments.data?.pages[0]?.total ?? item.counters.comment_count;
  const rows = useMemo(
    () => comments.data?.pages.flatMap((page) => page.items) ?? [],
    [comments.data],
  );

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) setReplyTo(null);
        onOpenChange(next);
      }}
    >
      <DrawerContent className="flex h-[82dvh] flex-col">
        <header className="relative flex items-center justify-center border-b border-border px-12 py-4">
          <DrawerTitle className="text-base font-semibold">
            Kommentariyalar ({formatCompact(total)})
          </DrawerTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Yopish"
            className="absolute right-4 grid size-8 place-items-center text-muted-foreground"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex items-center gap-2 border-b border-border px-5 py-2">
          {(["new", "top"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSort(value)}
              aria-pressed={sort === value}
              className={cn(
                "px-3 py-1 text-xs font-semibold transition-colors",
                sort === value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {value === "new" ? "Yangi" : "Ommabop"}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {comments.isPending ? (
            <ul className="space-y-6 p-5">
              {Array.from({ length: 4 }, (_, index) => (
                <li key={index} className="flex gap-3">
                  <span className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
                  <span className="flex-1 space-y-2">
                    <span className="block h-3 w-28 animate-pulse bg-muted" />
                    <span className="block h-4 w-full animate-pulse bg-muted" />
                  </span>
                </li>
              ))}
            </ul>
          ) : comments.isError ? (
            <div className="p-5">
              <ErrorState error={comments.error} onRetry={() => void comments.refetch()} compact />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Hali izoh yo'q. Birinchi bo'lib yozing.
            </p>
          ) : (
            <ul>
              {rows.map((comment) => (
                <li key={comment.id} className="border-b border-border px-5 py-4 last:border-b-0">
                  <CommentThread
                    comment={comment}
                    videoId={videoId}
                    authorId={item.author.id}
                    onReply={(name) => setReplyTo({ id: comment.id, name })}
                  />
                </li>
              ))}
            </ul>
          )}

          {comments.hasNextPage && (
            <div className="p-5">
              <button
                type="button"
                onClick={() => void comments.fetchNextPage()}
                disabled={comments.isFetchingNextPage}
                className="w-full border border-border-strong py-3 text-sm font-semibold disabled:opacity-50"
              >
                {comments.isFetchingNextPage ? "Yuklanmoqda…" : "Yana izohlar"}
              </button>
            </div>
          )}
        </div>

        <CommentComposer
          videoId={videoId}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </DrawerContent>
    </Drawer>
  );
}

/** One top-level comment with its replies, inlined and then paged. */
function CommentThread({
  comment,
  videoId,
  authorId,
  onReply,
}: {
  comment: FeedComment;
  videoId: string;
  authorId: string;
  onReply: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const inlined = comment.replies ?? [];
  const replies = useReplies(comment.id, expanded);

  // The thread endpoint starts from the beginning, so the inlined ones come
  // back again; they are dropped here rather than rendered twice.
  const paged = replies.data?.pages.flatMap((page) => page.items) ?? [];
  const shown = expanded && paged.length > 0 ? paged : inlined;
  const remaining = comment.reply_count - shown.length;

  return (
    <>
      <CommentRow
        comment={comment}
        videoId={videoId}
        authorId={authorId}
        onReply={() => onReply(comment.author.full_name ?? "izoh")}
      />

      {shown.length > 0 && (
        <ul className="mt-3 space-y-3 pl-12">
          {shown.map((reply) => (
            <li key={reply.id}>
              <CommentRow
                comment={reply}
                videoId={videoId}
                authorId={authorId}
                parentId={comment.id}
                onReply={() => onReply(reply.author.full_name ?? "izoh")}
                compact
              />
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => {
            if (!expanded) setExpanded(true);
            else void replies.fetchNextPage();
          }}
          disabled={replies.isFetching}
          className="mt-3 pl-12 text-xs font-semibold text-primary disabled:opacity-50"
        >
          {replies.isFetching ? "Yuklanmoqda…" : `Yana ${remaining} ta javobni ko'rish`}
        </button>
      )}
    </>
  );
}

function CommentRow({
  comment,
  videoId,
  authorId,
  parentId,
  onReply,
  compact = false,
}: {
  comment: FeedComment;
  videoId: string;
  authorId: string;
  parentId?: string | undefined;
  onReply: () => void;
  compact?: boolean | undefined;
}) {
  const me = useMe();
  const signedIn = useIsAuthenticated();
  const like = useToggleCommentLike();
  const remove = useDeleteComment(videoId);

  const mine = me.data?.id === comment.author.id;
  const byVideoAuthor = comment.author.id === authorId;
  const name = comment.author.full_name ?? "Foydalanuvchi";

  return (
    <div className="flex gap-3">
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-[10px] font-bold",
          compact ? "size-8" : "size-9",
        )}
      >
        {comment.author.avatar_url ? (
          <img src={comment.author.avatar_url} alt="" className="size-full object-cover" />
        ) : (
          initialsOf(name)
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className="font-semibold">{name}</span>
          {byVideoAuthor && (
            <>
              <BadgeCheck className="size-3.5 text-viz-2" aria-label="Video muallifi" />
              <span className="sr-only">Video muallifi</span>
            </>
          )}
          <span className="text-muted-foreground">· {timeAgoUz(comment.created_at)}</span>
        </p>
        <p
          className={cn(
            "mt-1 whitespace-pre-wrap break-words text-sm",
            comment.is_deleted && "italic text-muted-foreground",
          )}
        >
          {comment.body}
        </p>
        {!comment.is_deleted && (
          <div className="mt-1.5 flex items-center gap-4">
            <button
              type="button"
              onClick={onReply}
              className="text-xs font-medium text-muted-foreground"
            >
              Javob berish
            </button>
            {mine && (
              <button
                type="button"
                onClick={() =>
                  remove.mutate(
                    { commentId: comment.id, parentId },
                    {
                      onSuccess: () => toast.success("Izoh o'chirildi."),
                      onError: (error) =>
                        toast.error(
                          error instanceof Error ? error.message : "Izohni o'chirib bo'lmadi.",
                        ),
                    },
                  )
                }
                disabled={remove.isPending}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground disabled:opacity-50"
              >
                <Trash2 className="size-3.5" /> O'chirish
              </button>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          if (!signedIn) {
            toast.error("Yoqtirish uchun tizimga kiring.");
            return;
          }
          like.mutate(
            { commentId: comment.id, liked: comment.liked },
            {
              onError: (error) =>
                toast.error(error instanceof Error ? error.message : "Bajarilmadi."),
            },
          );
        }}
        aria-label={comment.liked ? "Yoqtirishni olish" : "Izohni yoqtirish"}
        aria-pressed={comment.liked}
        className="flex shrink-0 flex-col items-center gap-0.5 text-xs tabular-nums text-muted-foreground"
      >
        <Heart
          className={cn("size-4", comment.liked ? "fill-primary text-primary" : "text-primary")}
        />
        {comment.like_count > 0 && <span>{formatCompact(comment.like_count)}</span>}
      </button>
    </div>
  );
}

function CommentComposer({
  videoId,
  replyTo,
  onCancelReply,
}: {
  videoId: string;
  replyTo: { id: string; name: string } | null;
  onCancelReply: () => void;
}) {
  const navigate = useNavigate();
  const signedIn = useIsAuthenticated();
  const create = useCreateComment(videoId);
  const [body, setBody] = useState("");
  const fieldRef = useRef<HTMLInputElement | null>(null);

  const send = () => {
    const text = body.trim();
    if (!text) return;
    if (!signedIn) {
      toast.error("Izoh yozish uchun tizimga kiring.", {
        action: { label: "Kirish", onClick: () => void navigate({ to: "/login" }) },
      });
      return;
    }
    create.mutate(
      { body: text, parentId: replyTo?.id },
      {
        onSuccess: () => {
          setBody("");
          onCancelReply();
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Izoh yuborilmadi."),
      },
    );
  };

  return (
    <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {replyTo && (
        <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{replyTo.name} ga javob</span>
          <button type="button" onClick={onCancelReply} className="font-semibold text-primary">
            Bekor qilish
          </button>
        </p>
      )}
      <div className="flex items-center gap-2 border border-input bg-surface px-4 py-2.5">
        <input
          ref={fieldRef}
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, 2000))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Kommentariy yozing…"
          aria-label="Kommentariy yozing"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {/* The design's emoji control: it puts a smile in the field, nothing more. */}
        <button
          type="button"
          aria-label="Emoji qo'shish"
          onClick={() => {
            setBody((current) => `${current}🙂`.slice(0, 2000));
            fieldRef.current?.focus();
          }}
          className="shrink-0 text-warning"
        >
          <Smile className="size-5" />
        </button>
        <button
          type="button"
          onClick={send}
          disabled={create.isPending || body.trim().length === 0}
          aria-label="Yuborish"
          className="shrink-0 text-primary disabled:opacity-40"
        >
          <SendHorizontal className="size-5" />
        </button>
      </div>
    </div>
  );
}
