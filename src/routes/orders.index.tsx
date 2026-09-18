import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { EmptyState, Page, PageTitle } from "@/components/avtoqism/Page";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { ErrorState } from "@/components/avtoqism/States";
import { useIsAuthenticated } from "@/lib/query/session";
import { formatDate, formatSom } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { useOrders } from "@/lib/query/commerce";
import { OrderStatusPill } from "@/components/avtoqism/OrderStatusPill";

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
          {orders.data.map((order) => (
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
                </div>
                <div className="flex items-center gap-5">
                  <OrderStatusPill status={order.status} />
                  <span className="type-price">{formatSom(order.grand_total)}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
