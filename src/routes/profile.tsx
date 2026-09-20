import { createFileRoute, Link } from "@tanstack/react-router";
import { CarFront, Globe, LogOut, Receipt, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, Page, PageTitle, SectionHead } from "@/components/avtoqism/Page";
import { OrderStatusPill } from "@/components/avtoqism/OrderStatusPill";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { ErrorState } from "@/components/avtoqism/States";
import { StatTile, num } from "@/components/avtoqism/panel/Charts";
import { ExportButton } from "@/components/avtoqism/panel/Widgets";
import { useIsAuthenticated } from "@/lib/query/session";
import type { OrderOut, OrderStatus } from "@/lib/api/types";
import { formatDate, formatPhone, formatSom, groupDigits } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { useLogout, useMe } from "@/lib/query/auth";
import { useOrders } from "@/lib/query/commerce";
import { useActiveVehicle } from "@/lib/query/garage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Profil — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: Profile,
});

/** Money left the buyer's pocket for these; a cancellation or refund did not. */
const NOT_SPENT: readonly OrderStatus[] = ["CANCELLED", "REFUNDED"];
const IN_PROGRESS: readonly OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED"];
const ARRIVED: readonly OrderStatus[] = ["DELIVERED", "COMPLETED"];

type OrderFilter = "all" | "progress" | "arrived" | "cancelled";

const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "Hammasi" },
  { value: "progress", label: "Jarayonda" },
  { value: "arrived", label: "Yetkazilgan" },
  { value: "cancelled", label: "Bekor qilingan" },
];

function matchesFilter(order: OrderOut, filter: OrderFilter): boolean {
  switch (filter) {
    case "progress":
      return IN_PROGRESS.includes(order.status);
    case "arrived":
      return ARRIVED.includes(order.status);
    case "cancelled":
      return NOT_SPENT.includes(order.status);
    case "all":
      return true;
  }
}

function Profile() {
  const t = useT();
  const { lang, setLang } = useLang();
  const me = useMe();
  const logout = useLogout();
  const { activeVehicle } = useActiveVehicle();
  const signedIn = useIsAuthenticated();
  const orders = useOrders();
  const [filter, setFilter] = useState<OrderFilter>("all");

  /**
   * The buyer's totals.
   *
   * There is no `/me/purchase-summary` endpoint in the generated schema — see
   * the note at the bottom of `src/lib/query/storefront.ts` — so the figures are
   * derived here from the order list, which already carries every number they
   * need. Cancelled and refunded orders count towards neither spend nor savings:
   * that money came back.
   */
  const summary = useMemo(() => {
    const all = orders.data ?? [];
    let totalSpent = 0;
    let totalSaved = 0;
    let inProgress = 0;
    let paidOrders = 0;

    for (const order of all) {
      if (IN_PROGRESS.includes(order.status)) inProgress += 1;
      if (NOT_SPENT.includes(order.status)) continue;
      totalSpent += num(order.grand_total);
      totalSaved += num(order.discount_total);
      paidOrders += 1;
    }

    return {
      totalSpent,
      totalSaved,
      inProgress,
      orderCount: all.length,
      averageOrderValue: paidOrders > 0 ? totalSpent / paidOrders : 0,
    };
  }, [orders.data]);

  const visibleOrders = useMemo(
    () => (orders.data ?? []).filter((order) => matchesFilter(order, filter)),
    [orders.data, filter],
  );

  if (!signedIn) return <SignInRequired />;

  if (me.isError) {
    return (
      <Page>
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </Page>
    );
  }

  const user = me.data;
  const hasOrders = (orders.data ?? []).length > 0;

  return (
    <Page className="max-w-3xl">
      <PageTitle
        eyebrow={t("profile.title")}
        title={user?.full_name ?? t("profile.guest")}
        subtitle={user ? formatPhone(user.phone) || user.email || undefined : undefined}
      />

      {activeVehicle && (
        <Link
          to="/garage"
          className="flex items-center justify-between gap-4 border border-border bg-card p-5 transition-colors hover:bg-muted/50"
        >
          <span className="flex items-center gap-3">
            <CarFront className="size-5 text-primary" />
            <span>
              <span className="block font-semibold">{activeVehicle.variant.display_name}</span>
              <span className="type-caption">{t("garage.active")}</span>
            </span>
          </span>
        </Link>
      )}

      <nav className="mt-6 divide-y divide-border border-y border-border">
        <Item to="/orders" icon={Receipt} label={t("orders.title")} />
        <Item to="/cart" icon={ShoppingBag} label={t("cart.title")} />
        <Item to="/garage" icon={CarFront} label={t("garage.title")} />
      </nav>

      {/* --- purchase history ------------------------------------------------ */}
      <section className="mt-12">
        <SectionHead
          eyebrow={t("profile.title")}
          title="Xaridlar tarixi"
          action={<ExportButton path="/export/me/orders" label="Excelga yuklash" />}
        />

        {orders.isError ? (
          <ErrorState error={orders.error} onRetry={() => void orders.refetch()} compact />
        ) : orders.isPending ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-28 animate-pulse bg-muted" />
              ))}
            </div>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-36 animate-pulse bg-muted" />
            ))}
          </div>
        ) : !hasOrders ? (
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
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile
                label="Jami xarid"
                value={formatSom(summary.totalSpent)}
                hint={`o'rtacha ${formatSom(summary.averageOrderValue)}`}
              />
              <StatTile label="Tejaldi" value={formatSom(summary.totalSaved)} />
              <StatTile label="Buyurtmalar" value={groupDigits(summary.orderCount)} />
              <StatTile label="Jarayonda" value={groupDigits(summary.inProgress)} />
            </div>

            <div
              role="group"
              aria-label="Buyurtmalar filtri"
              className="mt-8 inline-flex flex-wrap border border-border"
            >
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-semibold transition-colors",
                    filter === option.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {visibleOrders.length === 0 ? (
              <p className="type-caption mt-6">Bu filtr bo'yicha buyurtma yo'q.</p>
            ) : (
              <ul className="mt-6 space-y-4">
                {visibleOrders.map((order) => (
                  <li key={order.id}>
                    <OrderCard order={order} lang={lang} numberLabel={t("orders.number")} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="mt-12">
        <h2 className="type-h3 mb-4 inline-flex items-center gap-2">
          <Globe className="size-4" /> {t("profile.language")}
        </h2>
        <div className="inline-flex border border-border">
          {(["uz", "ru"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={cn(
                "px-5 py-2.5 text-sm font-semibold transition-colors",
                lang === l ? "bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {l === "uz" ? "O'zbekcha" : "Русский"}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="mt-12 inline-flex items-center gap-2 border border-border px-5 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5"
      >
        <LogOut className="size-4" /> {t("auth.logout")}
      </button>
    </Page>
  );
}

/** At most four thumbnails; beyond that the card stops being scannable. */
const THUMBNAIL_LIMIT = 4;

function OrderCard({
  order,
  lang,
  numberLabel,
}: {
  order: OrderOut;
  lang: "uz" | "ru";
  numberLabel: string;
}) {
  const items = order.sub_orders.flatMap((sub) => sub.items);
  const sellers = order.sub_orders.map((sub) => sub.seller.store_name);
  const hidden = items.length - THUMBNAIL_LIMIT;

  return (
    <Link
      to="/orders/$orderId"
      params={{ orderId: order.id }}
      className="block border border-border bg-card p-5 transition-colors hover:bg-muted/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-h3">
            {numberLabel} {order.number}
          </p>
          <p className="type-caption mt-1">{formatDate(order.created_at, lang)}</p>
        </div>
        <OrderStatusPill status={order.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        {items.slice(0, THUMBNAIL_LIMIT).map((item) => (
          <div key={item.id} className="flex min-w-0 items-center gap-2">
            <div className="size-12 shrink-0 overflow-hidden bg-muted">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : null}
            </div>
            <span className="line-clamp-2 max-w-40 text-xs font-medium">{item.product_name}</span>
          </div>
        ))}
        {hidden > 0 && <span className="type-caption">+{hidden}</span>}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
        <p className="type-caption min-w-0 truncate">{sellers.join(", ")}</p>
        <p className="type-price">{formatSom(order.grand_total)}</p>
      </div>
    </Link>
  );
}

function Item({
  to,
  icon: Icon,
  label,
}: {
  to: "/orders" | "/cart" | "/garage";
  icon: typeof Receipt;
  label: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 py-4 transition-colors hover:text-primary">
      <Icon className="size-5 text-muted-foreground" />
      <span className="font-semibold">{label}</span>
    </Link>
  );
}
