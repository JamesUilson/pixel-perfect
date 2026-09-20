/**
 * The seller's order queue.
 *
 * A shop works this screen top to bottom: read what came in, move each order
 * one step along. So the only actions offered on a row are the transitions the
 * server will actually accept from that row's current status — an illegal
 * button is a wasted round trip and a confusing error.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "@/components/avtoqism/Page";
import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { num } from "@/components/avtoqism/panel/Charts";
import { PanelSection, PanelToolbar } from "@/components/avtoqism/panel/PanelShell";
import { useSellerId } from "@/components/avtoqism/panel/SellerContext";
import {
  Button,
  Cell,
  DataTable,
  ExportButton,
  Pill,
  Row,
} from "@/components/avtoqism/panel/Widgets";
import { formatDate, formatSom } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useChangeOrderStatus, useSellerOrders } from "@/lib/query/seller";
import type { SellerOrderRow } from "@/lib/query/seller";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/orders")({
  head: () => ({
    meta: [{ title: "Buyurtmalar — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: SellerOrders,
});

const STATUS_UZ: Record<string, string> = {
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

/** Mirrors the server's state machine. CANCELLED and REFUNDED are terminal. */
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED", "REFUNDED"],
  PREPARING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "DISPUTED"],
  DELIVERED: ["COMPLETED", "DISPUTED", "REFUNDED"],
  COMPLETED: ["DISPUTED", "REFUNDED"],
  DISPUTED: ["REFUNDED", "COMPLETED"],
  CANCELLED: [],
  REFUNDED: [],
};

const GOOD = ["DELIVERED", "COMPLETED"];
const WARNING = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED"];

function statusTone(status: string): "good" | "warning" | "critical" | "neutral" {
  if (GOOD.includes(status)) return "good";
  if (WARNING.includes(status)) return "warning";
  if (["CANCELLED", "REFUNDED", "DISPUTED"].includes(status)) return "critical";
  return "neutral";
}

function statusLabel(status: string): string {
  return STATUS_UZ[status] ?? status;
}

/** Walking a status backwards is never routine, so those moves read as danger. */
function isDestructive(status: string): boolean {
  return status === "CANCELLED" || status === "REFUNDED" || status === "DISPUTED";
}

function itemsSummary(row: SellerOrderRow): string {
  return row.items.map((item) => `${item.product_name} ×${item.quantity}`).join(", ");
}

function SellerOrders() {
  const sellerId = useSellerId();
  const { lang } = useLang();
  const orders = useSellerOrders(sellerId);
  const changeStatus = useChangeOrderStatus(sellerId);
  const [filter, setFilter] = useState<string>("ALL");

  const rows = useMemo(() => orders.data ?? [], [orders.data]);

  // Only offer a chip for a status that actually has rows — a filter that can
  // only ever return nothing is noise.
  const presentStatuses = useMemo(() => {
    const seen: string[] = [];
    for (const row of rows) if (!seen.includes(row.status)) seen.push(row.status);
    return seen;
  }, [rows]);

  const visible = useMemo(
    () => (filter === "ALL" ? rows : rows.filter((row) => row.status === filter)),
    [rows, filter],
  );

  const pendingOrderId =
    changeStatus.isPending && changeStatus.variables ? changeStatus.variables.orderId : null;
  const failedOrderId =
    changeStatus.isError && changeStatus.variables ? changeStatus.variables.orderId : null;
  const failureMessage = changeStatus.error?.message ?? null;

  return (
    <div className="space-y-5">
      <PanelToolbar>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Holat bo'yicha saralash">
          <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
            Hammasi
          </FilterChip>
          {presentStatuses.map((status) => (
            <FilterChip key={status} active={filter === status} onClick={() => setFilter(status)}>
              {statusLabel(status)}
            </FilterChip>
          ))}
        </div>
        <span className="ml-auto">
          <ExportButton path={`/export/seller/${sellerId}/orders`} />
        </span>
      </PanelToolbar>

      <PanelSection>
        {orders.isPending ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }, (_, index) => (
              <LineSkeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : orders.isError ? (
          <div className="p-5">
            <ErrorState error={orders.error} onRetry={() => void orders.refetch()} compact />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Hali buyurtma yo'q"
            subtitle="Mahsulotlaringiz katalogda ko'ringach, birinchi buyurtmalar shu yerda paydo bo'ladi."
          />
        ) : (
          <DataTable
            head={["Raqam", "Sana", "Mahsulotlar", "Summa", "Holat", "Amal"]}
            empty={<p className="type-caption">Bu holatda buyurtma yo'q.</p>}
          >
            {visible.map((row) => {
              const next = TRANSITIONS[row.status] ?? [];
              const busy = pendingOrderId === row.id;
              const summary = itemsSummary(row);
              return (
                <Row key={row.id}>
                  <Cell className="whitespace-nowrap font-semibold">{row.order_number}</Cell>
                  <Cell className="whitespace-nowrap">{formatDate(row.created_at, lang)}</Cell>
                  <Cell>
                    <span className="block max-w-[18rem] truncate" title={summary}>
                      {summary}
                    </span>
                  </Cell>
                  <Cell numeric className="whitespace-nowrap">
                    {formatSom(num(row.subtotal) + num(row.delivery_fee))}
                  </Cell>
                  <Cell>
                    <Pill tone={statusTone(row.status)}>{statusLabel(row.status)}</Pill>
                  </Cell>
                  <Cell>
                    {next.length === 0 ? (
                      <span className="type-caption">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {next.map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={isDestructive(status) ? "danger" : "outline"}
                            disabled={busy}
                            onClick={() =>
                              // `row.id` is the SUB-order id — the list endpoint
                              // returns sub-orders — and the status route takes
                              // an order id, which the API resolves from it.
                              changeStatus.mutate({ orderId: row.id, status })
                            }
                          >
                            {statusLabel(status)}
                          </Button>
                        ))}
                      </div>
                    )}
                    {failedOrderId === row.id && failureMessage && (
                      <p className="mt-1.5 text-xs text-destructive">{failureMessage}</p>
                    )}
                  </Cell>
                </Row>
              );
            })}
          </DataTable>
        )}
      </PanelSection>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "border px-3 py-2 text-xs font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
