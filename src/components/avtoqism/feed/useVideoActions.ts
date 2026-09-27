import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";

import {
  useToggleFollow,
  useToggleVideoLike,
  useToggleVideoSave,
  type FeedItem,
} from "@/lib/query/feed";
import { useIsAuthenticated } from "@/lib/query/session";

/**
 * The four interactions the rail offers, with the one rule they share.
 *
 * Browsing the feed needs no account; acting on it does. Rather than hide the
 * buttons from a signed-out visitor — which makes the feed look broken — each
 * one is tappable and says what it needs, with a way to get there.
 *
 * Failures are surfaced, not swallowed: the optimistic paint is rolled back by
 * the mutation and the message from the server is shown as it came.
 */
export function useVideoActions(item: FeedItem | null | undefined) {
  const navigate = useNavigate();
  const signedIn = useIsAuthenticated();
  const like = useToggleVideoLike();
  const save = useToggleVideoSave();
  const follow = useToggleFollow();

  const requireSignIn = useCallback(
    (what: string) => {
      toast.error(`${what} uchun tizimga kiring.`, {
        action: { label: "Kirish", onClick: () => void navigate({ to: "/login" }) },
      });
    },
    [navigate],
  );

  const failed = useCallback((error: unknown) => {
    toast.error(error instanceof Error ? error.message : "Amal bajarilmadi.");
  }, []);

  const toggleLike = useCallback(() => {
    if (!item) return;
    if (!signedIn) return requireSignIn("Yoqtirish");
    like.mutate({ videoId: item.video.id, liked: item.liked }, { onError: failed });
  }, [failed, item, like, requireSignIn, signedIn]);

  const toggleSave = useCallback(() => {
    if (!item) return;
    if (!signedIn) return requireSignIn("Saqlash");
    save.mutate({ videoId: item.video.id, saved: item.saved }, { onError: failed });
  }, [failed, item, requireSignIn, save, signedIn]);

  const toggleFollow = useCallback(() => {
    const seller = item?.seller;
    if (!seller) return;
    if (!signedIn) return requireSignIn("Obuna bo'lish");
    follow.mutate(
      { sellerId: seller.id, following: item.following },
      {
        onSuccess: (data) =>
          toast.success(data.following ? "Obuna bo'ldingiz." : "Obuna bekor qilindi."),
        onError: failed,
      },
    );
  }, [failed, follow, item, requireSignIn, signedIn]);

  return { signedIn, requireSignIn, toggleLike, toggleSave, toggleFollow };
}
