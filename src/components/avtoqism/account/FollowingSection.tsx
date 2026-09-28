/**
 * "Obuna bo'lgan do'konlar" — the account's own channels.
 *
 * `GET /me/following` returns stores and people in one list; the interface can
 * only create store-follows today, but the table holds both and a row this
 * screen could show and not act on would be a dead end, so both are handled.
 *
 * Unfollowing goes through the feed's own `useToggleFollow`, which is what
 * keeps the scroller and the creator page in step. That mutation knows nothing
 * about this list, so the row is dropped from it here and the list is refetched
 * once the server has answered — a row removed has to leave the list it was
 * removed from, not only the feed's cache.
 */
import { Link } from "@tanstack/react-router";
import { Store, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { EmptyState, SectionHead } from "@/components/avtoqism/Page";
import { ErrorState } from "@/components/avtoqism/States";
import { ListPager } from "./ListPager";
import { groupDigits } from "@/lib/format";
import {
  FOLLOWING_PAGE_SIZE,
  forgetFollowedStore,
  refreshFollowing,
  useFollowing,
  useUnfollowPerson,
  type FollowedChannel,
} from "@/lib/query/discovery";
import { useToggleFollow } from "@/lib/query/feed";

export function FollowingSection() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const following = useFollowing(page);
  const toggleFollow = useToggleFollow();
  const unfollowPerson = useUnfollowPerson();

  /**
   * The row goes the moment the button is pressed, and comes back if the
   * server refuses. Waiting for the round trip on a list this short reads as a
   * button that did nothing.
   */
  function unfollowStore(sellerId: string) {
    forgetFollowedStore(queryClient, sellerId);
    toggleFollow.mutate(
      { sellerId, following: true },
      {
        onError: () => toast.error("Obunani bekor qilib bo'lmadi. Qayta urinib ko'ring."),
        onSettled: () => refreshFollowing(queryClient),
      },
    );
  }

  function unfollowChannel(row: FollowedChannel) {
    if (row.store) {
      unfollowStore(row.store.id);
      return;
    }
    if (!row.person) return;
    unfollowPerson.mutate(
      { userId: row.person.id },
      { onError: () => toast.error("Obunani bekor qilib bo'lmadi. Qayta urinib ko'ring.") },
    );
  }

  const data = following.data;
  const rows = data?.items ?? [];

  return (
    <section>
      <SectionHead
        eyebrow="Feed"
        title="Obuna bo'lgan do'konlar"
        subtitle="Yangi kliplari lentangizda birinchi bo'lib chiqadi."
      />

      {following.isError ? (
        <ErrorState error={following.error} onRetry={() => void following.refetch()} compact />
      ) : following.isPending ? (
        <ul className="divide-y divide-border border-y border-border">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="h-20 animate-pulse bg-muted/60" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Hali hech kimga obuna bo'lmagansiz"
          subtitle="Bu yerda obuna bo'lgan do'konlaringiz to'planadi. Lentadan yoqqan do'konga obuna bo'ling — keyingi kliplari shu yerdan topiladi."
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
          <ul className="divide-y divide-border border-y border-border">
            {rows.map((row) => (
              <ChannelRow
                key={row.store?.id ?? row.person?.id ?? row.followed_at}
                row={row}
                onUnfollow={() => unfollowChannel(row)}
              />
            ))}
          </ul>
          <ListPager
            page={data?.page ?? page}
            size={FOLLOWING_PAGE_SIZE}
            total={data?.total ?? rows.length}
            pages={data?.pages ?? 1}
            busy={following.isFetching}
            label="Obunalar sahifalari"
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}

function ChannelRow({ row, onUnfollow }: { row: FollowedChannel; onUnfollow: () => void }) {
  const store = row.store;
  const person = row.person;
  const name = store?.store_name ?? person?.full_name ?? "Nomsiz kanal";
  const image = store ? (store.icon_url ?? store.logo_url) : person?.avatar_url;
  const counts = `${groupDigits(row.video_count)} ta klip · ${groupDigits(row.follower_count)} obunachi`;

  const identity = (
    <>
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden bg-muted">
        {image ? (
          <img src={image} alt="" loading="lazy" className="size-full object-cover" />
        ) : store ? (
          <Store className="size-5 text-muted-foreground" aria-hidden />
        ) : (
          <UserRound className="size-5 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{name}</span>
        <span className="type-caption mt-0.5 block truncate tabular-nums">{counts}</span>
        {store && (
          <span className="type-caption block truncate">
            {store.region}, {store.district}
          </span>
        )}
      </span>
    </>
  );

  return (
    <li className="flex items-center justify-between gap-4 py-4">
      {/*
       * Only a store has somewhere to go: `/feed/creators/{handle}` resolves a
       * store, and the slug is accepted wherever the handle is — which matters,
       * because a store that has never been opened as a creator profile has no
       * handle allocated yet. There is no screen for a person's channel, so
       * that row is text rather than a link that would 404.
       */}
      {store ? (
        <Link
          to="/feed/creators/$handle"
          params={{ handle: store.handle ?? store.slug }}
          className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:text-primary"
        >
          {identity}
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{identity}</span>
      )}

      <button
        type="button"
        onClick={onUnfollow}
        className="shrink-0 border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
      >
        Obunani bekor qilish
      </button>
    </li>
  );
}
