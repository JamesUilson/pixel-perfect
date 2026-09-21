import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { OrderStatusPill } from "@/components/avtoqism/OrderStatusPill";
import { Page, PageTitle } from "@/components/avtoqism/Page";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { ErrorState } from "@/components/avtoqism/States";
import { DeliveryAddressCard } from "@/components/avtoqism/delivery/DeliveryAddressCard";
import { DeliveryProgress } from "@/components/avtoqism/delivery/DeliveryProgress";
import { useIsAuthenticated } from "@/lib/query/session";
import { formatDateTime, formatSom } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { useCancelOrder, useOrder } from "@/lib/query/commerce";

const CANCELLABLE = new Set(["PENDING", "CONFIRMED", "PREPARING"]);

export const Route = createFileRoute("/orders/$orderId")({
  head: () => ({
    meta: [{ title: "Buyurtma — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId } = Route.useParams();
  const t = useT();
  const { lang } = useLang();
  const order = useOrder(orderId);
  const cancel = useCancelOrder();
  const signedIn = useIsAuthenticated();

  if (!signedIn) return <SignInRequired />;

  if (order.isPending) {
    return (
      <Page>
        <div className="h-96 animate-pulse bg-muted" />
      </Page>
    );
  }
  if (order.isError) {
    return (
      <Page>
        <ErrorState error={order.error} onRetry={() => void order.refetch()} />
      </Page>
    );
  }

  const data = order.data;
  // Only a fallback: an order placed before the server formatted the line for
  // everyone still has to render somewhere sensible.
  const snapshot = data.address_snapshot as Record<string, string | null | undefined>;
  const fallbackLine = [
    snapshot["region"],
    snapshot["district"],
    snapshot["street"],
    snapshot["house"] ? `${snapshot["house"]}-uy` : null,
    snapshot["entrance"] ? `${snapshot["entrance"]}-podyezd` : null,
    snapshot["floor"] ? `${snapshot["floor"]}-qavat` : null,
    snapshot["apartment"] ? `${snapshot["apartment"]}-xonadon` : null,
    snapshot["landmark"],
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Page>
      <Link
        to="/orders"
        className="mb-7 inline-flex items-center gap-2 text-sm font-semibold hover:text-primary"
      >
        <ChevronLeft className="size-4" /> {t("orders.title")}
      </Link>

      <PageTitle
        eyebrow={formatDateTime(data.created_at, lang)}
        title={`${t("orders.number")} ${data.number}`}
        action={<OrderStatusPill status={data.status} />}
      />

      {data.payment_url && data.status === "PENDING" && (
        <div className="mb-8 border border-primary/30 bg-primary/5 p-5">
          <p className="text-sm font-semibold">To'lov kutilmoqda</p>
          <p className="type-caption mt-1">
            To'lov tasdiqlangach buyurtma avtomatik ravishda qabul qilinadi.
          </p>
          {data.payment_url.startsWith("http") && (
            <a
              href={data.payment_url}
              className="mt-4 inline-flex bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              {t("checkout.payOnline")}
            </a>
          )}
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[1.6fr_0.8fr]">
        <div className="space-y-8">
          {data.delivery && <DeliveryProgress timeline={data.delivery} lang={lang} />}

          {data.sub_orders.map((sub) => (
            <section key={sub.id} className="border border-border bg-card">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <p className="font-semibold">{sub.seller.store_name}</p>
                  <p className="type-caption">
                    {sub.seller.district}, {sub.seller.region}
                  </p>
                </div>
                <OrderStatusPill status={sub.status} />
              </header>
              <ul className="divide-y divide-border">
                {sub.items.map((item) => (
                  <li key={item.id} className="flex gap-4 p-5">
                    <div className="size-20 shrink-0 overflow-hidden bg-muted">
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/product/$productId"
                        params={{ productId: item.product_slug }}
                        className="type-h3 line-clamp-2 hover:text-primary"
                      >
                        {item.product_name}
                      </Link>
                      {item.oem_number && (
                        <p className="type-caption mt-1">
                          {t("product.oem")}: {item.oem_number}
                        </p>
                      )}
                      <p className="type-caption mt-1">
                        {formatSom(item.unit_price)} × {item.quantity}
                      </p>
                    </div>
                    <p className="type-price shrink-0">{formatSom(item.line_total)}</p>
                  </li>
                ))}
              </ul>
              <footer className="flex justify-between border-t border-border px-5 py-4 text-sm">
                <span className="text-muted-foreground">{t("cart.deliveryTotal")}</span>
                <span className="font-semibold">
                  {Number(sub.delivery_fee) === 0 ? t("common.free") : formatSom(sub.delivery_fee)}
                </span>
              </footer>
            </section>
          ))}

          {data.events.length > 0 && (
            <section className="border border-border bg-card p-6">
              <h2 className="type-h3 mb-5">{t("orders.history")}</h2>
              <ol className="space-y-4">
                {data.events.map((e, i) => (
                  <li key={`${e.to_status}-${i}`} className="flex gap-4">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm font-semibold">{t(`orders.status.${e.to_status}`)}</p>
                      <p className="type-caption">
                        {formatDateTime(e.created_at, lang)}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-28">
          <div className="border border-border bg-card p-6">
            <h2 className="type-h3">{t("common.total")}</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("cart.subtotal")}</dt>
                <dd className="font-semibold">{formatSom(data.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("cart.deliveryTotal")}</dt>
                <dd className="font-semibold">
                  {Number(data.delivery_total) === 0
                    ? t("common.free")
                    : formatSom(data.delivery_total)}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
              <span className="font-semibold">{t("common.total")}</span>
              <span className="type-price-lg">{formatSom(data.grand_total)}</span>
            </div>
          </div>

          <DeliveryAddressCard
            address={data.delivery_address}
            line={fallbackLine}
            recipientName={data.recipient_name}
            recipientPhone={data.recipient_phone}
            contactIsSelf={data.contact_is_self ?? true}
            title={t("checkout.address")}
          />

          {CANCELLABLE.has(data.status) && (
            <button
              type="button"
              disabled={cancel.isPending}
              onClick={() => {
                if (!window.confirm(`${t("orders.cancel")}?`)) return;
                cancel.mutate(
                  { orderId: data.id },
                  { onError: (e) => toast.error((e as Error).message) },
                );
              }}
              className="inline-flex w-full items-center justify-center gap-2 border border-destructive/40 px-5 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
            >
              {cancel.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("orders.cancel")}
            </button>
          )}
        </aside>
      </div>
    </Page>
  );
}
