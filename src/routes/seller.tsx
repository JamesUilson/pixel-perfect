/**
 * The seller panel frame.
 *
 * Everything under /seller lives inside this layout, which resolves which
 * store is being managed before any child screen renders. Three states matter:
 * not signed in, signed in with no store yet, and signed in with at least one.
 * The middle one is the interesting case — it is where someone becomes a
 * seller, so it gets a real explanation rather than an empty table.
 */
import { useMemo, useState } from "react";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import {
  BadgePercent,
  BarChart3,
  Boxes,
  Clapperboard,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Package,
  Store,
  Wallet,
  Warehouse,
} from "lucide-react";

import { EmptyState, Page } from "@/components/avtoqism/Page";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { PanelShell, type PanelNavItem } from "@/components/avtoqism/panel/PanelShell";
import { SellerScopeProvider } from "@/components/avtoqism/panel/SellerContext";
import { Select } from "@/components/avtoqism/panel/Widgets";
import { useIsAuthenticated } from "@/lib/query/session";
import { useLowStock, useMyStores, useSellerOrders } from "@/lib/query/seller";

export const Route = createFileRoute("/seller")({
  head: () => ({
    meta: [
      { title: "Sotuvchi paneli — AVTOQISM" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SellerPanelLayout,
});

function SellerPanelLayout() {
  const signedIn = useIsAuthenticated();
  const stores = useMyStores();
  const [chosenId, setChosenId] = useState<string | null>(null);

  const seller = useMemo(() => {
    const list = stores.data ?? [];
    return list.find((s) => s.id === chosenId) ?? list[0] ?? null;
  }, [stores.data, chosenId]);

  if (!signedIn) return <SignInRequired />;

  if (stores.isPending) {
    return (
      <Page>
        <div className="space-y-4">
          <LineSkeleton className="h-10 w-64" />
          <LineSkeleton className="h-64 w-full" />
        </div>
      </Page>
    );
  }

  if (stores.isError) {
    return (
      <Page>
        <ErrorState error={stores.error} onRetry={() => void stores.refetch()} />
      </Page>
    );
  }

  if (!seller) return <NoStoreYet />;

  return (
    <SellerScopeProvider value={{ seller, sellers: stores.data, setSellerId: setChosenId }}>
      <SellerNav seller={seller} sellers={stores.data} onSwitch={setChosenId} />
    </SellerScopeProvider>
  );
}

function SellerNav({
  seller,
  sellers,
  onSwitch,
}: {
  seller: { id: string; store_name: string; status: string };
  sellers: { id: string; store_name: string }[];
  onSwitch: (id: string) => void;
}) {
  // Counts on the sidebar, so the two things that need action are visible from
  // any screen without opening them.
  const orders = useSellerOrders(seller.id);
  const lowStock = useLowStock(seller.id);

  const waiting = (orders.data ?? []).filter((o) =>
    ["PENDING", "CONFIRMED", "PREPARING"].includes(o.status),
  ).length;

  const items: PanelNavItem[] = [
    { to: "/seller", label: "Boshqaruv", icon: LayoutDashboard, exact: true },
    { to: "/seller/orders", label: "Buyurtmalar", icon: ClipboardList, badge: waiting },
    { to: "/seller/products", label: "Mahsulotlar", icon: Package },
    {
      to: "/seller/warehouses",
      label: "Omborlar",
      icon: Warehouse,
      badge: lowStock.data?.length ?? 0,
    },
    { to: "/seller/finance", label: "Moliya", icon: Wallet },
    { to: "/seller/promotions", label: "Aksiyalar", icon: BadgePercent },
    { to: "/seller/ads", label: "Reklama", icon: Megaphone },
    { to: "/seller/videos", label: "Videolar", icon: Clapperboard },
    { to: "/seller/feed", label: "Statistika", icon: BarChart3 },
    { to: "/seller/settings", label: "Do'kon sozlamalari", icon: Store },
  ];

  return (
    <PanelShell
      title={seller.store_name}
      subtitle="Sotuvchi paneli"
      items={items}
      toolbar={
        sellers.length > 1 ? (
          <Select
            aria-label="Do'konni tanlash"
            value={seller.id}
            onChange={(event) => onSwitch(event.target.value)}
            className="w-56"
          >
            {sellers.map((store) => (
              <option key={store.id} value={store.id}>
                {store.store_name}
              </option>
            ))}
          </Select>
        ) : undefined
      }
    >
      {seller.status !== "ACTIVE" && <PendingApprovalNotice status={seller.status} />}
      <Outlet />
    </PanelShell>
  );
}

/**
 * A store that is not yet approved can be set up but cannot sell. Saying so
 * once, at the top of every screen, is kinder than letting someone build a
 * catalogue and discover at the end that nothing is live.
 */
function PendingApprovalNotice({ status }: { status: string }) {
  const rejected = status === "REJECTED" || status === "SUSPENDED";
  return (
    <div
      className={
        rejected
          ? "mb-6 border border-destructive/40 bg-destructive/8 px-5 py-4"
          : "mb-6 border border-warning/40 bg-warning/10 px-5 py-4"
      }
    >
      <p className="text-sm font-semibold">
        {rejected ? "Do'kon faol emas" : "Do'kon tasdiqlanmoqda"}
      </p>
      <p className="type-caption mt-1">
        {rejected
          ? "Administrator do'koningizni to'xtatgan. Sabab va tiklash uchun qo'llab-quvvatlash xizmatiga murojaat qiling."
          : "Mahsulot qo'shishingiz va omborni to'ldirishingiz mumkin — tasdiqlangandan so'ng ular katalogda ko'rinadi."}
      </p>
    </div>
  );
}

function NoStoreYet() {
  return (
    <Page>
      <EmptyState
        title="Sizda hali do'kon yo'q"
        subtitle="AVTOQISMda sotish uchun do'kon oching. Ro'yxatdan o'tish bepul, komissiya faqat sotuvdan olinadi."
        action={
          <Link
            to="/seller/onboard"
            className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Store className="size-4" /> Do'kon ochish
          </Link>
        }
      />
      <div className="mx-auto mt-10 grid max-w-3xl gap-px bg-border sm:grid-cols-3">
        {[
          {
            icon: Boxes,
            title: "Ombor tizimi",
            body: "Bir nechta filial, har bir javondagi qoldiq va har bir harakatning tarixi.",
          },
          {
            icon: Wallet,
            title: "Shaffof pul",
            body: "Har bir buyurtmadan qancha olganingiz, komissiya qancha bo'lgani va qachon yechish mumkinligi.",
          },
          {
            icon: Megaphone,
            title: "Reklama va aksiyalar",
            body: "Bosh sahifa slayderi, chegirmalar va promokodlar — hammasi o'zingiz boshqarasiz.",
          },
        ].map((card) => (
          <div key={card.title} className="bg-card p-6">
            <card.icon className="mb-3 size-5 text-primary" aria-hidden />
            <h3 className="type-h3">{card.title}</h3>
            <p className="type-caption mt-2">{card.body}</p>
          </div>
        ))}
      </div>
    </Page>
  );
}
