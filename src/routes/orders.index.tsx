import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, ChevronRight, Clock } from "lucide-react";

import { EmptyState, Page, PageTitle } from "@/components/avtoqism/Page";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { ErrorState } from "@/components/avtoqism/States";
import { useIsAuthenticated } from "@/lib/query/session";
import { formatDate, formatSom } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { useOrders } from "@/lib/query/commerce";
import { OrderStatusPill } from "@/components/avtoqism/OrderStatusPill";
import { currentStageLabel } from "@/components/avtoqism/delivery/timeline";
import { calendarDayIso } from "@/components/avtoqism/delivery/address";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [{ title: "Buyurtmalar — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: Orders,
});

function Orders() {
  const t = useT();
  const { lang } = useLang();
  const orders = useOrders();
  const signedIn = useIsAuthenticated();

  if (!signedIn) return <SignInRequired />;

  return (
    <Page>
      <PageTitle eyebrow="AVTOQISM" title={t("orders.title")} />

      {orders.isPending ? (
        <div className="space-y-px bg-border">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse bg-card" />
          ))}
        </div>
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
      ) : orders.data.length === 0 ? (
        <EmptyState
          title={t("orders.empty")}
          subtitle={t("orders.emptySub")}
          action={
            <Link
              to="/marketplace"
              className="inline-flex bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              {t("cart.goShopping")}
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {orders.data.map((order) => {
            // The status pill is the machine's word for it; the stage is the
            // one the buyer was shown on the order page, so the two screens
            // cannot tell them different stories.
            const stage = currentStageLabel(order.delivery);
            const promised = order.delivery?.promised_date ?? order.promised_date ?? null;
            const late = order.delivery?.late ?? false;

            return (
              <li key={order.id}>
                <Link
                  to="/orders/$orderId"
                  params={{ orderId: order.id }}
                  className="flex flex-wrap items-center justify-between gap-4 py-5 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="type-h3">
                      {t("orders.number")} {order.number}
                    </p>
                    <p className="type-caption mt-1">
                      {formatDate(order.created_at, lang)} ·{" "}
                      {order.sub_orders.reduce((n, s) => n + s.items.length, 0)} {t("common.pcs")} ·{" "}
                      {order.sub_orders.map((s) => s.seller.store_name).join(", ")}
                    </p>
                    {(stage ?? promised) && (
                      <p className="type-caption mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {stage && <span className="font-semibold text-foreground">{stage}</span>}
                        {promised && (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="size-3.5" />
                            {formatDate(calendarDayIso(promised), lang)}gacha
                          </span>
                        )}
                        {late && (
                          <span className="inline-flex items-center gap-1.5 bg-warning/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-warning-foreground">
                            <Clock className="size-3" /> Kechikmoqda
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-5">
                    <OrderStatusPill status={order.status} />
                    <span className="type-price">{formatSom(order.grand_total)}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
