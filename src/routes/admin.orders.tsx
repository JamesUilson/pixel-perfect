/**
 * Buyurtmalar — what the API can honestly give.
 *
 * There is no admin endpoint that lists orders across the whole marketplace,
 * and inventing one would only produce a table that never loads. What does
 * exist is the status breakdown and the Excel export, so that is what this
 * screen is: how many orders sit in each state and how much money each state
 * holds, with the full register one download away. The copy says so plainly
 * rather than leaving an admin hunting for a search box that is not there.
 */
import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { ChartCard, DonutChart, num } from "@/components/avtoqism/panel/Charts";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import { Cell, DataTable, ExportButton, Row } from "@/components/avtoqism/panel/Widgets";
import { formatSom, groupDigits } from "@/lib/format";
import { usePlatformStatuses } from "@/lib/query/admin";
import { foldSeries } from "@/lib/viz";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [{ title: "Buyurtmalar — AVTOQISM" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminOrders,
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

function AdminOrders() {
  const statuses = usePlatformStatuses();
  // Memoised because two `useMemo`s below depend on it: a fresh `[]` on every
  // render would recompute the totals and the donut for nothing.
  const rows = useMemo(() => statuses.data ?? [], [statuses.data]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({ count: acc.count + row.count, amount: acc.amount + num(row.amount) }),
      { count: 0, amount: 0 },
    );
  }, [rows]);

  const slices = useMemo(() => {
    const mapped = rows
      .filter((row) => row.count > 0)
      .map((row) => ({ name: ORDER_STATUS_UZ[row.status] ?? row.status, value: row.count }));
    return foldSeries(
      mapped,
      (row) => row.value,
      5,
      (total) => ({
        name: "Boshqalar",
        value: total,
      }),
    );
  }, [rows]);

  return (
    <div className="space-y-6">
      <PanelSection
        title="Buyurtmalar holati"
        subtitle="Platformadagi barcha buyurtmalar, holati bo'yicha."
        action={<ExportButton path="/export/admin/orders" label="Buyurtmalar Excelda" />}
      >
        <p className="border-b border-border bg-muted/40 px-5 py-3 text-sm text-muted-foreground">
          Bu yerda buyurtmalar jadvali yo'q: API platformadagi barcha buyurtmalarni ro'yxat
          ko'rinishida bermaydi. To'liq reyestr — har bir buyurtma, do'kon, xaridor va summa bilan —
          yuqoridagi tugma orqali Excel faylida yuklanadi.
        </p>

        {statuses.isPending ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }, (_, index) => (
              <LineSkeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : statuses.isError ? (
          <div className="p-5">
            <ErrorState error={statuses.error} onRetry={() => void statuses.refetch()} compact />
          </div>
        ) : (
          <DataTable
            head={["Holat", "Soni", "Summa"]}
            empty={<p className="type-caption">Hali birorta buyurtma yo'q.</p>}
          >
            {/*
             * One array, not a list plus a conditional: `DataTable` decides
             * whether to show its empty state from the children it is handed,
             * and a trailing `false` would make an empty table look populated.
             */}
            {rows.length === 0
              ? null
              : [
                  ...rows.map((row) => (
                    <Row key={row.status}>
                      <Cell className="whitespace-nowrap font-semibold">
                        {ORDER_STATUS_UZ[row.status] ?? row.status}
                      </Cell>
                      <Cell numeric>{groupDigits(row.count)}</Cell>
                      <Cell numeric className="whitespace-nowrap">
                        {formatSom(num(row.amount))}
                      </Cell>
                    </Row>
                  )),
                  <Row key="__total" className="bg-muted/40">
                    <Cell className="whitespace-nowrap font-semibold">Jami</Cell>
                    <Cell numeric className="font-semibold">
                      {groupDigits(totals.count)}
                    </Cell>
                    <Cell numeric className="whitespace-nowrap font-semibold">
                      {formatSom(totals.amount)}
                    </Cell>
                  </Row>,
                ]}
          </DataTable>
        )}
      </PanelSection>

      {statuses.isPending || statuses.isError || slices.length === 0 ? (
        <section className="border border-border bg-card p-5">
          <h3 className="type-h3">Ulushlar</h3>
          {statuses.isPending ? (
            <LineSkeleton className="mt-4 h-[260px] w-full" />
          ) : statuses.isError ? (
            <div className="mt-4">
              <ErrorState error={statuses.error} onRetry={() => void statuses.refetch()} compact />
            </div>
          ) : (
            <p className="type-caption py-12 text-center">Hali birorta buyurtma yo'q.</p>
          )}
        </section>
      ) : (
        <ChartCard title="Ulushlar" subtitle="Buyurtmalar soni bo'yicha nisbat.">
          <DonutChart data={slices} />
        </ChartCard>
      )}
    </div>
  );
}
