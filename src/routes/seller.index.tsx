/**
 * The seller dashboard — the screen a shop opens every morning.
 *
 * It answers four questions in order: how much did I sell, where did the money
 * go, what is waiting for me, and what is about to run out. Every card owns its
 * own query, so a single failing endpoint costs one card rather than the page.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import {
  ChartCard,
  DonutChart,
  HorizontalBars,
  StackedBars,
  RevenueArea,
  StatTile,
  num,
} from "@/components/avtoqism/panel/Charts";
import { PanelSection, PanelToolbar } from "@/components/avtoqism/panel/PanelShell";
import { useSellerId } from "@/components/avtoqism/panel/SellerContext";
import {
  Cell,
  DataTable,
  ExportButton,
  RangePicker,
  Row,
} from "@/components/avtoqism/panel/Widgets";
import type { OrderStatus } from "@/lib/api/types";
import { formatSom, groupDigits } from "@/lib/format";
import {
  useLowStock,
  useSellerMoneyFlow,
  useSellerOverview,
  useSellerSales,
  useSellerStatuses,
  useSellerStockChart,
  useSellerTopProducts,
} from "@/lib/query/seller";
import { foldSeries } from "@/lib/viz";

export const Route = createFileRoute("/seller/")({
  head: () => ({
    meta: [{ title: "Boshqaruv paneli — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: SellerDashboard,
});

const ORDER_STATUS_UZ: Record<OrderStatus, string> = {
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

/** The chrome a chart card wears while it is loading, failing or empty. */
function CardFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section className="border border-border bg-card p-5">
      <h3 className="type-h3">{title}</h3>
      {subtitle && <p className="type-caption mt-1">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * One chart, with its own four states.
 *
 * `ChartCard` hands its child straight to a `ResponsiveContainer`, which only
 * accepts a chart element — so the skeleton and the error cannot live inside it
 * and get their own frame instead.
 */
function ChartFrame<T>({
  title,
  subtitle,
  query,
  isEmpty,
  height = 260,
  render,
}: {
  title: string;
  subtitle?: string | undefined;
  query: UseQueryResult<T, Error>;
  isEmpty: (data: T) => boolean;
  height?: number | undefined;
  render: (data: T) => ReactElement;
}) {
  if (query.isPending) {
    return (
      <CardFrame title={title} subtitle={subtitle}>
        <div style={{ height }}>
          <LineSkeleton className="h-full w-full" />
        </div>
      </CardFrame>
    );
  }
  if (query.isError) {
    return (
      <CardFrame title={title} subtitle={subtitle}>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
      </CardFrame>
    );
  }
  if (isEmpty(query.data)) {
    return (
      <CardFrame title={title} subtitle={subtitle}>
        <p className="type-caption py-12 text-center">Bu davr uchun ma'lumot yo'q.</p>
      </CardFrame>
    );
  }
  return (
    <ChartCard title={title} subtitle={subtitle} height={height}>
      {render(query.data)}
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
          <LineSkeleton className="mt-3 h-3 w-14" />
        </div>
      ))}
    </div>
  );
}

function SellerDashboard() {
  const sellerId = useSellerId();
  const [days, setDays] = useState(30);

  const overview = useSellerOverview(sellerId, days);
  const sales = useSellerSales(sellerId, days);
  const moneyFlow = useSellerMoneyFlow(sellerId, days);
  const statuses = useSellerStatuses(sellerId);
  const stock = useSellerStockChart(sellerId);
  const topProducts = useSellerTopProducts(sellerId, days);
  const lowStock = useLowStock(sellerId);

  const lowStockRows = lowStock.data ?? [];

  return (
    <div className="space-y-6">
      <PanelToolbar>
        <RangePicker value={days} onChange={setDays} />
        <span className="ml-auto">
          <ExportButton
            path={`/export/seller/${sellerId}/all?days=${days}`}
            label="Hammasini Excelga"
          />
        </span>
      </PanelToolbar>

      {lowStockRows.length > 0 && (
        <PanelSection
          className="border-warning/40 bg-warning/10"
          title="Tugab qolgan mahsulotlar"
          subtitle={`${groupDigits(lowStockRows.length)} ta pozitsiya ogohlantirish chegarasidan pastda.`}
          action={
            <Link
              to="/seller/warehouses"
              className="inline-flex items-center gap-2 border border-border-strong bg-card px-3 py-1.5 text-xs font-semibold"
            >
              Omborlarga o'tish
            </Link>
          }
        >
          <ul className="divide-y divide-border">
            {lowStockRows.slice(0, 5).map((row) => (
              <li
                key={row.inventory_item_id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-warning-foreground" aria-hidden />
                  <span className="truncate text-sm font-medium">{row.product_name}</span>
                </span>
                <span className="type-caption shrink-0">
                  {row.warehouse_name} · {groupDigits(row.available)} dona
                </span>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}

      {overview.isPending ? (
        <TileSkeletons count={8} />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} compact />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Savdo"
              value={formatSom(num(overview.data.gross_sales))}
              delta={overview.data.gross_sales_change_percent}
            />
            <StatTile label="Sof daromad" value={formatSom(num(overview.data.net_earnings))} />
            <StatTile
              label="Buyurtmalar"
              value={groupDigits(overview.data.order_count)}
              delta={overview.data.order_count_change_percent}
            />
            <StatTile
              label="O'rtacha chek"
              value={formatSom(num(overview.data.average_order_value))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Kutayotgan buyurtmalar"
              value={groupDigits(overview.data.open_orders)}
            />
            <StatTile
              label="Tugab qolganlar"
              value={groupDigits(overview.data.low_stock_count)}
              deltaGoodWhenUp={false}
            />
            <StatTile
              label="Ombordagi qiymat"
              value={formatSom(num(overview.data.stock_retail_value))}
            />
            <StatTile label="Reklama xarajati" value={formatSom(num(overview.data.ad_spend))} />
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFrame
          title="Kunlik savdo"
          query={sales}
          isEmpty={(rows) => rows.length === 0}
          render={(rows) => <RevenueArea data={rows} />}
        />

        {/*
         * Earnings and the deductions taken out of them are the same currency
         * but not the same order of magnitude — commission is a few per cent of
         * a sale. Drawn together, the three small series flatten against the
         * axis and say nothing. Two charts, one scale each.
         */}
        <ChartFrame
          title="Xarajatlar"
          subtitle="Komissiya, reklama va yechib olingan pul"
          query={moneyFlow}
          isEmpty={(rows) => rows.length === 0}
          render={(rows) => (
            <StackedBars
              data={rows}
              series={[
                { key: "commission", name: "Komissiya" },
                { key: "ads", name: "Reklama" },
                { key: "payouts", name: "Yechilgan" },
              ]}
            />
          )}
        />

        <ChartFrame
          title="Buyurtmalar holati"
          query={statuses}
          isEmpty={(rows) => rows.every((row) => row.count === 0)}
          render={(rows) => {
            // A status with no orders is not a slice of anything; dropping the
            // zeroes first also keeps the fold from spending a slot on them.
            const slices = foldSeries(
              rows
                .filter((row) => row.count > 0)
                .map((row) => ({ name: ORDER_STATUS_UZ[row.status], value: row.count })),
              (slice) => slice.value,
              5,
              (total) => ({ name: "Boshqalar", value: total }),
            );
            return <DonutChart data={slices} />;
          }}
        />

        <ChartFrame
          title="Omborlar bo'yicha qoldiq"
          query={stock}
          isEmpty={(rows) => rows.length === 0}
          render={(rows) => (
            <HorizontalBars data={rows} labelKey="warehouse" valueKey="retail_value" />
          )}
        />
      </div>

      <PanelSection title="Eng ko'p sotilganlar" subtitle={`So'nggi ${days} kun`}>
        {topProducts.isPending ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <LineSkeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        ) : topProducts.isError ? (
          <div className="p-5">
            <ErrorState
              error={topProducts.error}
              onRetry={() => void topProducts.refetch()}
              compact
            />
          </div>
        ) : (
          <DataTable
            head={["Mahsulot", "Dona", "Buyurtma", "Savdo"]}
            empty={<p className="type-caption">Bu davrda sotuv bo'lmagan.</p>}
          >
            {topProducts.data.map((product, index) => (
              <Row key={product.product_id ?? `${product.product_name}-${index}`}>
                <Cell>{product.product_name}</Cell>
                <Cell numeric>{groupDigits(product.units)}</Cell>
                <Cell numeric>{groupDigits(product.orders)}</Cell>
                <Cell numeric>{formatSom(num(product.revenue))}</Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </PanelSection>
    </div>
  );
}
