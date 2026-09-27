/**
 * Statistika — what the store's clips did.
 *
 * One endpoint answers the whole screen, so the screen has one set of states
 * rather than one per card. Two decisions are worth naming:
 *
 *   - **a missing baseline is a dash, never a zero.** Over "Barcha" there is no
 *     previous window to compare against and the server sends `previous: null`;
 *     the tile prints "—" rather than inventing 0%;
 *   - **the design's fourth breakdown is by age, and this system stores no
 *     birth date.** The slot keeps its bar-list shape and is filled with the
 *     two breakdowns the data can answer — follower against stranger, new
 *     against returning — and the server's own sentence says why age is absent.
 *     Nothing here estimates an age.
 */
import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Eye, Heart, MessageCircle, Send, Video } from "lucide-react";

import { EmptyState } from "@/components/avtoqism/Page";
import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { PeriodChips, windowLabel } from "@/components/avtoqism/creator/PeriodChips";
import { ShareBars } from "@/components/avtoqism/creator/ShareBars";
import { ChartCard, DonutChart, MultiLine, StatTile } from "@/components/avtoqism/panel/Charts";
import { PanelSection, PanelToolbar } from "@/components/avtoqism/panel/PanelShell";
import { useSellerId } from "@/components/avtoqism/panel/SellerContext";
import { Cell, DataTable, Row } from "@/components/avtoqism/panel/Widgets";
import { formatCompact, formatDate, groupDigits } from "@/lib/format";
import type { CreatorStats, StatsWindow } from "@/lib/query/seller";
import { useCreatorStats, useSellerVideos } from "@/lib/query/seller";
import { foldSeries } from "@/lib/viz";

export const Route = createFileRoute("/seller/feed")({
  head: () => ({
    meta: [{ title: "Statistika — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: CreatorStatsScreen,
});

/** A share of a whole, or "—" when the whole is nothing. */
function share(value: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((value / total) * 100)}%`;
}

function TileSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="border border-border bg-card p-5">
          <LineSkeleton className="mb-4 h-3 w-20" />
          <LineSkeleton className="h-7 w-24" />
          <LineSkeleton className="mt-3 h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

function CreatorStatsScreen() {
  const sellerId = useSellerId();
  const [window, setWindow] = useState<StatsWindow>("30");

  const stats = useCreatorStats(sellerId, window);
  // Only to tell "nothing happened in this window" apart from "this store has
  // never posted" — a grid of zeros is a useless answer to the second one.
  const videos = useSellerVideos(sellerId, 1, 1);

  const neverPosted = videos.isSuccess && videos.data.total === 0;

  return (
    <div className="space-y-6">
      <PanelToolbar>
        <PeriodChips value={window} onChange={setWindow} />
        <span className="ml-auto">
          <Link
            to="/seller/videos"
            className="inline-flex items-center gap-2 border border-border-strong bg-card px-3 py-2 text-xs font-semibold"
          >
            <Video className="size-4" aria-hidden />
            Videolarim
          </Link>
        </span>
      </PanelToolbar>

      {neverPosted ? (
        <EmptyState
          title="Hali video joylamagansiz"
          subtitle="Statistika birinchi videongizdan keyin paydo bo'ladi. Qisqa video — mahsulotingizni ishlayotgan holda ko'rsatishning eng tez yo'li."
          action={
            <Link
              to="/seller/videos"
              className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              <Video className="size-4" aria-hidden />
              Birinchi videoni joylash
            </Link>
          }
        />
      ) : stats.isPending ? (
        <div className="space-y-6">
          <TileSkeletons />
          <LineSkeleton className="h-72 w-full" />
        </div>
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <StatsBody data={stats.data} window={window} />
      )}
    </div>
  );
}

function StatsBody({ data, window }: { data: CreatorStats; window: StatsWindow }) {
  const { tiles, audience } = data;
  const totalViews = tiles.views.total;

  const regionRows = audience.by_region.rows;
  const regionTotal = regionRows.reduce((sum, row) => sum + row.views, 0);
  // Six slots in the palette and no seventh hue is ever generated; the tail is
  // summed into one row instead.
  const slices = foldSeries(
    regionRows.map((row) => ({ name: row.region, value: row.views })),
    (slice) => slice.value,
    6,
    (total) => ({ name: "Boshqa", value: total }),
  );

  const follow = audience.by_follow;
  const recency = audience.by_recency;
  const followTotal = follow.followers + follow.non_followers;
  const recencyTotal = recency.new + recency.returning;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile
          label="Ko'rishlar"
          value={formatCompact(tiles.views.total)}
          delta={tiles.views.change_percent}
          icon={<Eye className="size-4" aria-hidden />}
        />
        <StatTile
          label="Layklar"
          value={formatCompact(tiles.likes.total)}
          delta={tiles.likes.change_percent}
          icon={<Heart className="size-4" aria-hidden />}
        />
        <StatTile
          label="Kommentlar"
          value={formatCompact(tiles.comments.total)}
          delta={tiles.comments.change_percent}
          icon={<MessageCircle className="size-4" aria-hidden />}
        />
        <StatTile
          label="Ulashishlar"
          value={formatCompact(tiles.shares.total)}
          delta={tiles.shares.change_percent}
          icon={<Send className="size-4" aria-hidden />}
        />
      </div>

      {window === "all" ? (
        <p className="type-caption">
          «Barcha» davrida oldingi davr yo'q, shuning uchun o'zgarish foizi ko'rsatilmaydi.
        </p>
      ) : null}

      {/*
       * `MultiLine` with one series rather than `RevenueArea`: the area chart's
       * tooltip formats its value as som, and these are view counts. One series
       * draws no legend — the card title already says what is plotted.
       */}
      <ChartCard
        title="Ko'rishlar grafigi"
        subtitle={
          data.series_days < data.days
            ? `So'nggi ${groupDigits(data.series_days)} kun (jami ${groupDigits(data.days)} kundan)`
            : undefined
        }
        action={
          <span className="type-label border border-border px-2.5 py-1 text-muted-foreground">
            {windowLabel(window)}
          </span>
        }
        height={280}
      >
        <MultiLine
          data={data.views_by_day}
          series={[{ key: "views", name: "Ko'rishlar" }]}
          money={false}
        />
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Auditoriya"
          subtitle={`Jami ${formatCompact(totalViews)} ko'rish`}
          height={300}
        >
          {slices.length > 0 ? (
            <DonutChart data={slices} />
          ) : (
            <p className="type-caption grid h-full place-items-center">
              Bu davrda ko'rishlar bo'lmagan.
            </p>
          )}
        </ChartCard>

        {/*
         * The table beside the donut is not decoration: three of the six
         * palette hues sit under 3:1 on the light surface, and the rule for
         * using them is that the values are legible somewhere on the screen
         * without relying on the colour. It also carries the percentages the
         * donut's own legend cannot.
         */}
        <PanelSection
          title="Mintaqalar"
          subtitle="Tomoshabin mintaqasi, ma'lum bo'lmasa — videoning mintaqasi."
        >
          <DataTable
            head={["Mintaqa", "Ko'rishlar", "Ulush"]}
            empty={<p className="type-caption">Bu davrda ko'rishlar bo'lmagan.</p>}
          >
            {regionRows.map((row) => (
              <Row key={row.region}>
                <Cell>{row.region}</Cell>
                <Cell numeric>{groupDigits(row.views)}</Cell>
                <Cell numeric>{share(row.views, regionTotal)}</Cell>
              </Row>
            ))}
          </DataTable>
        </PanelSection>
      </div>

      <PanelSection
        title="Auditoriya toifasi"
        subtitle="Kim ko'rdi va qaytib keldimi — yosh o'rniga tizim biladigan taqsimotlar."
      >
        <div className="grid gap-8 p-5 sm:grid-cols-2">
          <div>
            <h4 className="type-label mb-3 text-muted-foreground">Obunachilar va begonalar</h4>
            <ShareBars
              rows={[
                { label: "Obunachilar", value: follow.followers },
                { label: "Obuna bo'lmaganlar", value: follow.non_followers },
              ]}
              total={followTotal}
              note={
                follow.anonymous > 0
                  ? `Kim ko'rgani aniqlanmagan: ${groupDigits(follow.anonymous)} ko'rish.`
                  : undefined
              }
            />
          </div>
          <div>
            <h4 className="type-label mb-3 text-muted-foreground">Yangi va qaytgan tomoshabin</h4>
            <ShareBars
              rows={[
                { label: "Yangi", value: recency.new },
                { label: "Qaytgan", value: recency.returning },
              ]}
              total={recencyTotal}
              note={
                recency.anonymous_views > 0
                  ? `Tanib bo'lmaydigan ko'rishlar: ${groupDigits(recency.anonymous_views)}.`
                  : undefined
              }
            />
          </div>
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          {audience.by_age_note}
        </p>
      </PanelSection>

      <PanelSection
        title="Top videolar"
        subtitle={`${windowLabel(window)} ichida eng ko'p ko'rilgan`}
      >
        <DataTable
          head={["Video", "Ko'rishlar", "Layklar", "Kommentlar", "Ulashishlar"]}
          empty={<p className="type-caption">Bu davrda ko'rilgan video yo'q.</p>}
        >
          {data.top_videos.map((clip) => (
            <Row key={clip.video_id}>
              <Cell>
                <Link
                  to="/feed"
                  search={{ video: clip.video_id }}
                  className="flex items-center gap-3 hover:text-primary"
                >
                  {clip.thumbnail_url ? (
                    <img
                      src={clip.thumbnail_url}
                      alt=""
                      className="size-12 shrink-0 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="grid size-12 shrink-0 place-items-center bg-muted">
                      <Video className="size-4 text-muted-foreground" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="line-clamp-1 font-medium">
                      {clip.caption?.trim() || "Sarlavhasiz video"}
                    </span>
                    <span className="type-caption block">
                      {clip.published_at ? formatDate(clip.published_at) : "E'lon qilinmagan"}
                    </span>
                  </span>
                </Link>
              </Cell>
              <Cell numeric>{groupDigits(clip.views)}</Cell>
              <Cell numeric>{groupDigits(clip.likes)}</Cell>
              <Cell numeric>{groupDigits(clip.comments)}</Cell>
              <Cell numeric>{groupDigits(clip.shares)}</Cell>
            </Row>
          ))}
        </DataTable>
      </PanelSection>
    </div>
  );
}
