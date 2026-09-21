/**
 * The seller's order queue.
 *
 * A shop works this screen top to bottom: read what came in, move each order
 * one step along. So the only actions offered on a row are the transitions the
 * server will actually accept from that row's current status — an illegal
 * button is a wasted round trip and a confusing error.
 *
 * The startup has no couriers yet: the person reading this screen is also the
 * driver. That is why a row carries who to ring and a tap that opens Navigator
 * alongside the packing actions — the whole job is done from this one table.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Banknote,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  UserRound,
} from "lucide-react";

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
import { formatDate, formatPhone, formatSom } from "@/lib/format";
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
  READY: "Tayyor bo'ldi",
  SHIPPED: "Yo'lda",
  DELIVERED: "Yetkazildi",
  COMPLETED: "Yakunlandi",
  CANCELLED: "Bekor qilindi",
  REFUNDED: "Qaytarildi",
  DISPUTED: "Nizoli",
};

/**
 * `ORDER_TRANSITIONS` from `app/core/enums.py`, copied whole.
 *
 * Every button on this screen is built from this map and nothing else, so a
 * move the machine refuses is never drawn and the seller never meets a 409.
 * When the backend gains a state, this is the one place that changes.
 */
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED", "REFUNDED"],
  PREPARING: ["READY", "SHIPPED", "CANCELLED", "REFUNDED"],
  READY: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "DISPUTED"],
  DELIVERED: ["COMPLETED", "DISPUTED", "REFUNDED"],
  COMPLETED: ["DISPUTED", "REFUNDED"],
  DISPUTED: ["REFUNDED", "COMPLETED"],
  CANCELLED: [],
  REFUNDED: [],
};

/**
 * The buyer-facing timeline from `app/modules/orders/stages.py`, in order. The
 * seller sees the same words the buyer does, so a phone call about "tayyor
 * bo'ldi" means the same thing on both ends of the line.
 */
const STAGES = [
  { key: "placed", label: "Qabul qilindi" },
  { key: "packing", label: "Yig'ilmoqda" },
  { key: "ready", label: "Tayyor bo'ldi" },
  { key: "on_the_way", label: "Kuryerga berildi" },
  { key: "delivered", label: "Yetkazildi" },
] as const;

const STAGE_UZ: Record<string, string> = Object.fromEntries(
  STAGES.map((stage) => [stage.key, stage.label]),
);

/** Orders that left the timeline: cancelled, refunded, disputed. */
const OFF_TIMELINE = "OFF";

const PAYMENT_UZ: Record<string, string> = {
  CASH_ON_DELIVERY: "Naqd — yetkazganda olinadi",
  CLICK: "Click",
  PAYME: "Payme",
  UZCARD: "Uzcard",
  HUMO: "Humo",
  CARD: "Karta",
  WALLET: "Hamyon",
  SANDBOX: "Sinov to'lovi",
};

const GOOD = ["DELIVERED", "COMPLETED"];
const WARNING = ["PENDING", "CONFIRMED", "PREPARING", "READY", "SHIPPED"];

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

function stageKey(row: SellerOrderRow): string {
  return row.stage ?? OFF_TIMELINE;
}

function SellerOrders() {
  const sellerId = useSellerId();
  const { lang } = useLang();
  const orders = useSellerOrders(sellerId);
  const changeStatus = useChangeOrderStatus(sellerId);
  const [filter, setFilter] = useState<string>("ALL");

  const rows = useMemo(() => orders.data ?? [], [orders.data]);

  /*
   * Packing order, not arrival order. What the seller needs first is the parcel
   * that is already overdue, then the one promised soonest; an order with no
   * promised date is either finished or off the timeline, so it goes last.
   */
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.late !== b.late) return a.late ? -1 : 1;
      if (a.promised_date !== b.promised_date) {
        if (!a.promised_date) return 1;
        if (!b.promised_date) return -1;
        return a.promised_date < b.promised_date ? -1 : 1;
      }
      return a.created_at < b.created_at ? -1 : 1;
    });
  }, [rows]);

  const lateCount = useMemo(() => rows.filter((row) => row.late).length, [rows]);

  // Only offer a chip for a stage that actually has rows — a filter that can
  // only ever return nothing is noise.
  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = stageKey(row);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === "ALL") return sorted;
    if (filter === "LATE") return sorted.filter((row) => row.late);
    return sorted.filter((row) => stageKey(row) === filter);
  }, [sorted, filter]);

  const pendingOrderId =
    changeStatus.isPending && changeStatus.variables ? changeStatus.variables.orderId : null;
  const failedOrderId =
    changeStatus.isError && changeStatus.variables ? changeStatus.variables.orderId : null;
  const failureMessage = changeStatus.error?.message ?? null;

  return (
    <div className="space-y-5">
      <PanelToolbar>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Bosqich bo'yicha saralash">
          <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
            {`Hammasi (${rows.length})`}
          </FilterChip>
          {lateCount > 0 && (
            <FilterChip
              active={filter === "LATE"}
              onClick={() => setFilter("LATE")}
              tone="critical"
            >
              {`Kechikkan (${lateCount})`}
            </FilterChip>
          )}
          {STAGES.filter((stage) => stageCounts.has(stage.key)).map((stage) => (
            <FilterChip
              key={stage.key}
              active={filter === stage.key}
              onClick={() => setFilter(stage.key)}
            >
              {`${stage.label} (${stageCounts.get(stage.key) ?? 0})`}
            </FilterChip>
          ))}
          {stageCounts.has(OFF_TIMELINE) && (
            <FilterChip active={filter === OFF_TIMELINE} onClick={() => setFilter(OFF_TIMELINE)}>
              {`Bekor va nizoli (${stageCounts.get(OFF_TIMELINE) ?? 0})`}
            </FilterChip>
          )}
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
            head={[
              "Raqam",
              "Bosqich",
              "Mahsulotlar",
              "Summa",
              "Kim bilan bog'lanish",
              "Manzil",
              "Amal",
            ]}
            empty={<p className="type-caption">Bu bosqichda buyurtma yo'q.</p>}
          >
            {visible.map((row) => {
              const next = TRANSITIONS[row.status] ?? [];
              const busy = pendingOrderId === row.order_id;
              const summary = itemsSummary(row);
              return (
                <Row key={row.id} className={cn(row.late && "bg-destructive/5")}>
                  <Cell className="whitespace-nowrap align-top">
                    <span className="block font-semibold">{row.order_number}</span>
                    <span className="type-caption mt-1 block">
                      {formatDate(row.created_at, lang)}
                    </span>
                  </Cell>

                  <Cell className="align-top">
                    <StageCell row={row} lang={lang} />
                  </Cell>

                  <Cell className="align-top">
                    <span className="block max-w-[18rem] truncate" title={summary}>
                      {summary}
                    </span>
                    {row.comment && (
                      <span className="type-caption mt-1 flex max-w-[18rem] items-start gap-1.5">
                        <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span>{row.comment}</span>
                      </span>
                    )}
                  </Cell>

                  <Cell numeric className="whitespace-nowrap align-top">
                    {formatSom(num(row.subtotal) + num(row.delivery_fee))}
                    <span className="mt-1 block">
                      {row.payment_method === "CASH_ON_DELIVERY" ? (
                        <Pill tone="warning">
                          <Banknote className="size-3" aria-hidden />
                          Naqd
                        </Pill>
                      ) : (
                        <span className="type-caption font-normal">
                          {PAYMENT_UZ[row.payment_method] ?? row.payment_method}
                        </span>
                      )}
                    </span>
                  </Cell>

                  <Cell className="align-top">
                    <ContactCell row={row} />
                  </Cell>

                  <Cell className="align-top">
                    <AddressCell row={row} />
                  </Cell>

                  <Cell className="align-top">
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
                              // The parent order id, not `row.id`: the list
                              // returns sub-orders, and the status endpoint
                              // loads an order.
                              changeStatus.mutate({ orderId: row.order_id, status })
                            }
                          >
                            {statusLabel(status)}
                          </Button>
                        ))}
                      </div>
                    )}
                    {failedOrderId === row.order_id && failureMessage && (
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

/** Where the order stands, and whether the promise has already been broken. */
function StageCell({ row, lang }: { row: SellerOrderRow; lang: "uz" | "ru" }) {
  const stage = row.stage ? STAGE_UZ[row.stage] : null;
  return (
    <div className="space-y-1.5">
      <Pill tone={statusTone(row.status)}>{stage ?? statusLabel(row.status)}</Pill>
      {stage && (
        // The status is the machine's word for it; the stage is the buyer's.
        // Both are shown because the buttons below act on the status.
        <span className="type-caption block">{statusLabel(row.status)}</span>
      )}
      {row.promised_date && (
        <span
          className={cn(
            "block text-xs",
            row.late ? "font-semibold text-destructive" : "text-muted-foreground",
          )}
        >
          {`Va'da: ${formatDate(row.promised_date, lang)}`}
        </span>
      )}
      {row.late && (
        <Pill tone="critical">
          <AlertTriangle className="size-3" aria-hidden />
          Kechikdi
        </Pill>
      )}
    </div>
  );
}

/**
 * Who picks up the phone.
 *
 * When the buyer ordered for somebody else the number belongs to that other
 * person, who did not ask to be rung. Saying so is the difference between a
 * useful call and a rude one.
 */
function ContactCell({ row }: { row: SellerOrderRow }) {
  return (
    <div className="space-y-1.5">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {row.recipient_name}
      </span>
      <a
        href={`tel:${row.recipient_phone}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <Phone className="size-3.5" aria-hidden />
        {formatPhone(row.recipient_phone)}
      </a>
      {!row.contact_is_self && (
        <span className="block">
          <Pill tone="info">Qabul qiluvchi — boshqa shaxs</Pill>
          <span className="type-caption mt-1 block">
            Buyurtmani boshqa odam bergan. Qo'ng'iroq qilishdan oldin o'zingizni tanishtiring.
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * The address, and the tap that starts the drive.
 *
 * Both links come from the server. `navigator_url` is the `yandexnavi://` deep
 * link, which does nothing on a phone without the app — so the maps link is
 * always offered beside it, and it is the one that works on a laptop.
 */
function AddressCell({ row }: { row: SellerOrderRow }) {
  const address = row.delivery_address;
  const line = address.line || "Manzil ko'rsatilmagan";
  return (
    <div className="max-w-[16rem] space-y-2">
      <span className="flex items-start gap-1.5 text-sm">
        <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span>{line}</span>
      </span>
      {address.navigator_url || address.maps_url ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {address.navigator_url && (
            <a
              href={address.navigator_url}
              className="inline-flex items-center justify-center gap-2 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Navigation className="size-3.5" aria-hidden />
              Yandex Navigatorda ochish
            </a>
          )}
          {address.maps_url && (
            <a
              href={address.maps_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 border border-border-strong bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
            >
              Xaritada
            </a>
          )}
        </div>
      ) : (
        <span className="type-caption block">
          Xarita nuqtasi yo'q — manzilni telefon orqali aniqlang.
        </span>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  tone = "default",
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone?: "default" | "critical" | undefined;
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
          : tone === "critical"
            ? "border-destructive/40 bg-card text-destructive hover:bg-destructive/10"
            : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
