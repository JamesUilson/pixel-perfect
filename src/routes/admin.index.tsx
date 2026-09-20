/**
 * Umumiy — the whole marketplace on one screen.
 *
 * The order is deliberate. The first row is what the business made; the second
 * is where the platform's own cut came from; the third is the money that is not
 * the platform's to spend — escrow it is holding for buyers, and what it owes
 * sellers — plus how many shops and people there are. Only then the charts.
 *
 * Every card fetches and fails on its own. A dead categories endpoint should
 * cost one card, not the dashboard.
 */
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import {
  ChartCard,
  DonutChart,
  HorizontalBars,
  MultiLine,
  RevenueArea,
  StackedBars,
  StatTile,
  num,
} from "@/components/avtoqism/panel/Charts";
import { PanelSection, PanelToolbar } from "@/components/avtoqism/panel/PanelShell";
import {
  Cell,
  DataTable,
  ExportButton,
  RangePicker,
  Row,
} from "@/components/avtoqism/panel/Widgets";
import type { CategorySlice } from "@/lib/api/types";
import { formatSom, groupDigits } from "@/lib/format";
import {
  usePlatformCategories,
  usePlatformGmv,
  usePlatformInventory,
  usePlatformOverview,
  usePlatformStatuses,
  usePlatformUsers,
  useTopSellers,
} from "@/lib/query/admin";
import { foldSeries } from "@/lib/viz";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Umumiy — AVTOQISM" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminOverview,
});

const ORDER_STATUS_UZ: Record<string, string> = {
  PENDING: "Kutilmoqda",
  CONFIRMED: "Tasdiqlandi",
  PREPARING: "Tayyorlanmoqda",
  SHIPPED: "Yo'lda",
  DELIVERED: "Yetkazildi",
  COMPLETED: "Yakunlandi",
  CANCELLED: "Bekor qilindi",
  REFUNDED: "Qaytarildi",
  DISPUTED: "Nizoli",
};

/**
 * `ChartCard` hands its child straight to a ResponsiveContainer, which accepts
 * only a chart element — so loading, error and empty get a plain frame that
 * looks the same but holds text.
 */
function ChartFrame({
  title,
  subtitle,
  action,
  isPending,
  error,
  onRetry,
  isEmpty,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  isEmpty: boolean;
  children: ReactNode;
}) {
  if (isPending || error || isEmpty) {
    return (
      <section className="border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="type-h3">{title}</h3>
            {subtitle && <p className="type-caption mt-1">{subtitle}</p>}
          </div>
          {action}
        </div>
        {isPending ? (
          <LineSkeleton className="h-[260px] w-full" />
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} compact />
        ) : (
          <p className="type-caption py-12 text-center">Bu davr uchun ma'lumot yo'q.</p>
        )}
      </section>
    );
  }
  return (
    <ChartCard title={title} subtitle={subtitle} action={action}>
      {children}
    </ChartCard>
  );
}

function TileSkeletons({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="border border-border bg-card p-5">
          <LineSkeleton className="mb-4 h-3 w-24" />
          <LineSkeleton className="h-7 w-32" />
        </div>
      ))}
    </div>
  );
}

/* --- screen --------------------------------------------------------------------- */
function AdminOverview() {
  const [days, setDays] = useState(30);

  return (
    <div className="space-y-6">
      <PanelToolbar>
        <RangePicker value={days} onChange={setDays} />
        <span className="ml-auto">
          <ExportButton path={`/export/admin/all?days=${days}`} label="Hammasini Excelga" />
        </span>
      </PanelToolbar>

      <OverviewTiles days={days} />
      <GmvCard days={days} />
      <StatusAndCategoryCards days={days} />
      <UsersCard days={days} />
      <TopSellersSection days={days} />
      <InventorySection />
    </div>
  );
}

/* --- the three rows of figures ---------------------------------------------------- */
function OverviewTiles({ days }: { days: number }) {
  const overview = usePlatformOverview(days);

  if (overview.isPending) {
    return (
      <div className="space-y-4">
        <TileSkeletons count={4} />
        <TileSkeletons count={4} />
        <TileSkeletons count={4} />
      </div>
    );
  }
  if (overview.isError) {
    return <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />;
  }

  const data = overview.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Aylanma (GMV)"
          value={formatSom(num(data.gmv))}
          delta={data.gmv_change_percent}
          hint="xaridorlar to'lagan jami summa"
        />
        <StatTile
          label="Platforma daromadi"
          value={formatSom(num(data.total_revenue))}
          hint="komissiya + yetkazish + reklama"
        />
        <StatTile
          label="Buyurtmalar"
          value={groupDigits(data.order_count)}
          delta={data.order_count_change_percent}
        />
        <StatTile label="O'rtacha chek" value={formatSom(num(data.average_order_value))} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Komissiya" value={formatSom(num(data.commission_revenue))} />
        <StatTile label="Yetkazish" value={formatSom(num(data.delivery_revenue))} />
        <StatTile label="Reklama" value={formatSom(num(data.ad_revenue))} />
        <StatTile
          label="Qaytarilgan"
          value={formatSom(num(data.refunded))}
          deltaGoodWhenUp={false}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Escrowdagi pul"
          value={formatSom(num(data.escrow_held))}
          hint="xaridorlar puli, hali sotuvchiga o'tmagan"
        />
        <StatTile label="Sotuvchilarga qarz" value={formatSom(num(data.owed_to_sellers))} />
        <StatTile
          label="Faol do'konlar"
          value={`${groupDigits(data.sellers_active)} / ${groupDigits(data.sellers_total)}`}
        />
        <StatTile
          label="Yangi foydalanuvchilar"
          value={groupDigits(data.users_new)}
          hint={`${groupDigits(data.users_total)} jami`}
        />
      </div>
    </div>
  );
}

/* --- charts ----------------------------------------------------------------------- */
function GmvCard({ days }: { days: number }) {
  const gmv = usePlatformGmv(days);
  const rows = gmv.data ?? [];
  const error = gmv.isError ? gmv.error : null;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartFrame
        title="Kunlik aylanma"
        subtitle="Har kuni xaridorlar to'lagan summa."
        isPending={gmv.isPending}
        error={error}
        onRetry={() => void gmv.refetch()}
        isEmpty={rows.length === 0}
      >
        <RevenueArea data={rows} valueKey="gmv" name="Aylanma" />
      </ChartFrame>

      <ChartFrame
        title="Platforma daromadi"
        subtitle="Aylanmaning platformaga qolgan qismi, manbalari bo'yicha."
        isPending={gmv.isPending}
        error={error}
        onRetry={() => void gmv.refetch()}
        isEmpty={rows.length === 0}
      >
        <StackedBars
          data={rows}
          series={[
            { key: "commission", name: "Komissiya" },
            { key: "delivery", name: "Yetkazish" },
            { key: "ads", name: "Reklama" },
          ]}
        />
      </ChartFrame>
    </div>
  );
}

function StatusAndCategoryCards({ days }: { days: number }) {
  const statuses = usePlatformStatuses();
  const categories = usePlatformCategories(days);

  const statusSlices = useMemo(() => {
    const rows = (statuses.data ?? [])
      .filter((row) => row.count > 0)
      .map((row) => ({ name: ORDER_STATUS_UZ[row.status] ?? row.status, value: row.count }));
    return foldSeries(
      rows,
      (row) => row.value,
      5,
      (total) => ({
        name: "Boshqalar",
        value: total,
      }),
    );
  }, [statuses.data]);

  const categoryRows = useMemo(() => {
    const rows = categories.data ?? [];
    return foldSeries(
      rows,
      (row) => num(row.revenue),
      8,
      (total): CategorySlice => ({ category: "Boshqalar", revenue: String(total), units: 0 }),
    );
  }, [categories.data]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartFrame
        title="Buyurtmalar holati"
        subtitle="Platformadagi barcha buyurtmalar."
        isPending={statuses.isPending}
        error={statuses.isError ? statuses.error : null}
        onRetry={() => void statuses.refetch()}
        isEmpty={statusSlices.length === 0}
      >
        <DonutChart data={statusSlices} />
      </ChartFrame>

      <ChartFrame
        title="Kategoriyalar ulushi"
        subtitle="Savdo hajmi bo'yicha eng katta kategoriyalar."
        isPending={categories.isPending}
        error={categories.isError ? categories.error : null}
        onRetry={() => void categories.refetch()}
        isEmpty={categoryRows.length === 0}
      >
        <HorizontalBars data={categoryRows} labelKey="category" valueKey="revenue" />
      </ChartFrame>
    </div>
  );
}

function UsersCard({ days }: { days: number }) {
  const users = usePlatformUsers(days);
  const rows = users.data ?? [];

  return (
    <ChartFrame
      title="Foydalanuvchilar o'sishi"
      subtitle="Har kuni ro'yxatdan o'tganlar soni."
      isPending={users.isPending}
      error={users.isError ? users.error : null}
      onRetry={() => void users.refetch()}
      isEmpty={rows.length === 0}
    >
      {/*
       * A headcount, not money — `MultiLine` with `money={false}` so the
       * tooltip says "412" and never "412 so'm".
       */}
      <MultiLine
        data={rows}
        series={[{ key: "users", name: "Yangi foydalanuvchilar" }]}
        money={false}
      />
    </ChartFrame>
  );
}

/* --- tables ------------------------------------------------------------------------ */
function TopSellersSection({ days }: { days: number }) {
  const top = useTopSellers(days);

  return (
    <PanelSection
      title="Eng yaxshi sotuvchilar"
      subtitle="Tanlangan davrdagi savdo hajmi bo'yicha."
      action={<ExportButton path="/export/admin/sellers" />}
    >
      {top.isPending ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }, (_, index) => (
            <LineSkeleton key={index} className="h-6 w-full" />
          ))}
        </div>
      ) : top.isError ? (
        <div className="p-5">
          <ErrorState error={top.error} onRetry={() => void top.refetch()} compact />
        </div>
      ) : (
        <DataTable
          head={["Do'kon", "Buyurtmalar", "Savdo", "Komissiya"]}
          empty={<p className="type-caption">Bu davrda hech bir do'kon sotuv qilmagan.</p>}
        >
          {top.data.map((seller) => (
            <Row key={seller.seller_id}>
              <Cell>
                <span className="font-semibold">{seller.store_name}</span>
                <span className="type-caption block">{seller.slug}</span>
              </Cell>
              <Cell numeric>{groupDigits(seller.orders)}</Cell>
              <Cell numeric className="whitespace-nowrap">
                {formatSom(num(seller.sales))}
              </Cell>
              <Cell numeric className="whitespace-nowrap">
                {formatSom(num(seller.commission))}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </PanelSection>
  );
}

function InventorySection() {
  const inventory = usePlatformInventory();

  return (
    <PanelSection title="Ombor holati" subtitle="Platformadagi barcha do'konlarning zaxirasi.">
      {inventory.isPending ? (
        <div className="p-5">
          <TileSkeletons count={4} />
        </div>
      ) : inventory.isError ? (
        <div className="p-5">
          <ErrorState error={inventory.error} onRetry={() => void inventory.refetch()} compact />
        </div>
      ) : (
        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          <InventoryFigure
            label="Zaxiradagi birliklar"
            value={groupDigits(inventory.data.units)}
            hint={`${groupDigits(inventory.data.warehouses)} ta omborda`}
          />
          <InventoryFigure
            label="Band qilingan"
            value={groupDigits(inventory.data.reserved)}
            hint="ochilmagan buyurtmalar uchun"
          />
          <InventoryFigure
            label="Zaxira qiymati"
            value={formatSom(num(inventory.data.retail_value))}
            hint="chakana narxlarda"
          />
          <InventoryFigure
            label="Qoldiqsiz takliflar"
            value={groupDigits(inventory.data.out_of_stock_offers)}
            hint="katalogda bor, omborda yo'q"
          />
        </div>
      )}
    </PanelSection>
  );
}

function InventoryFigure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-card p-5">
      <p className="type-label text-muted-foreground">{label}</p>
      <p className="font-display mt-3 text-[1.5rem] font-semibold leading-none tracking-tight">
        {value}
      </p>
      <p className="type-caption mt-2">{hint}</p>
    </div>
  );
}
