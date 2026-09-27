import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatCompact } from "@/lib/format";
import type { FeedItem } from "@/lib/query/feed";
import { cn } from "@/lib/utils";

type Props = {
  item: FeedItem;
  onLike: () => void;
  onComments: () => void;
  onShare: () => void;
  onSave: () => void;
  className?: string | undefined;
};

/**
 * The right-hand rail of the scroller: like, comment, share, save.
 *
 * Counts sit under the first three and are the live ones — each button's state
 * is painted from the cache the mutation patches, so a tap changes the number
 * under the thumb and a failure changes it back.
 */
export function ActionRail({ item, onLike, onComments, onShare, onSave, className }: Props) {
  const { counters } = item;
  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <RailButton
        icon={Heart}
        label={formatCompact(counters.like_count)}
        active={item.liked}
        activeLabel
        onClick={onLike}
        aria={item.liked ? "Yoqtirishni olish" : "Yoqtirish"}
        pressed={item.liked}
      />
      <RailButton
        icon={MessageCircle}
        label={formatCompact(counters.comment_count)}
        onClick={onComments}
        aria="Izohlar"
      />
      <RailButton
        icon={Send}
        // The design writes the word until there is a number worth showing.
        label={counters.share_count > 0 ? formatCompact(counters.share_count) : "Ulashish"}
        onClick={onShare}
        aria="Ulashish"
      />
      <RailButton
        icon={Bookmark}
        label="Saqlash"
        active={item.saved}
        onClick={onSave}
        aria={item.saved ? "Saqlanganlardan olish" : "Saqlash"}
        pressed={item.saved}
      />
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  active = false,
  activeLabel = false,
  onClick,
  aria,
  pressed,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean | undefined;
  activeLabel?: boolean | undefined;
  onClick: () => void;
  aria: string;
  pressed?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      aria-pressed={pressed}
      className="flex flex-col items-center gap-1 text-[11px] font-semibold"
    >
      <span className="grid size-11 place-items-center rounded-full bg-background/45 backdrop-blur-sm transition-transform active:scale-95">
        <Icon className={cn("size-5", active && "fill-primary text-primary")} />
      </span>
      <span className={cn("tabular-nums", active && activeLabel && "text-primary")}>{label}</span>
    </button>
  );
}
