import { Link } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";

import { creatorHandle, initialsOf, placeOf, sellerAvatar } from "./util";
import type { FeedSellerBrief } from "@/lib/query/feed";
import { cn } from "@/lib/utils";

const VERIFIED_LEVELS = new Set(["VERIFIED", "TRUSTED_SELLER"]);

type Props = {
  seller: FeedSellerBrief;
  following: boolean;
  onToggleFollow: () => void;
  /** The preview mode shows what a visitor sees but must not act as one. */
  disabled?: boolean | undefined;
  className?: string | undefined;
};

/**
 * Avatar, store name, where it is, and the follow control — the row that sits
 * over the clip and repeats on the detail screen. The whole left side is the
 * link to the profile; the button is not, so a tap on "Obuna bo'lish" does not
 * also navigate away from the clip.
 */
export function StoreRow({ seller, following, onToggleFollow, disabled, className }: Props) {
  const avatar = sellerAvatar(seller);
  const verified = VERIFIED_LEVELS.has(seller.verification_level);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Link
        to="/feed/creators/$handle"
        params={{ handle: creatorHandle(seller) }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-xs font-bold text-background">
          {avatar ? (
            <img src={avatar} alt="" className="size-full object-cover" />
          ) : (
            initialsOf(seller.store_name)
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-sm font-semibold">
            <span className="truncate">{seller.store_name}</span>
            {verified && <BadgeCheck className="size-4 shrink-0 text-viz-2" />}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{placeOf(seller)}</span>
        </span>
      </Link>

      <button
        type="button"
        onClick={onToggleFollow}
        disabled={disabled}
        aria-pressed={following}
        className={cn(
          "shrink-0 border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
          following
            ? "border-border-strong text-muted-foreground"
            : "border-primary bg-primary text-primary-foreground",
        )}
      >
        {following ? "Obuna bo'lingan" : "Obuna bo'lish"}
      </button>
    </div>
  );
}
