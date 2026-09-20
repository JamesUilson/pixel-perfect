/**
 * The super-admin frame.
 *
 * Everything under /admin sits inside this layout. It answers one question
 * before any child screen renders: is the person looking at this allowed to?
 *
 * The check here is a courtesy, not a control. Every admin endpoint enforces
 * staff-ness on the server for every single call, so a role list that is stale,
 * spoofed or simply wrong changes nothing about what the API will hand over. It
 * exists so a customer who follows a stray link gets a calm explanation instead
 * of eight screens of red error states.
 */
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import {
  BadgePercent,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Store,
  Wallet,
} from "lucide-react";

import { EmptyState, Page } from "@/components/avtoqism/Page";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { PanelShell, type PanelNavItem } from "@/components/avtoqism/panel/PanelShell";
import { useAdminCampaigns, useAdminPayouts } from "@/lib/query/admin";
import { useMe } from "@/lib/query/auth";
import { useIsAuthenticated } from "@/lib/query/session";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin panel — AVTOQISM" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPanelLayout,
});

/**
 * The generated schema types `UserOut.roles` as a plain `string[]` — FastAPI
 * does not emit a `Role` enum — so the staff set is spelled out here rather
 * than imported. These are the five roles the back office grants; CUSTOMER and
 * SELLER are not among them.
 */
const STAFF_ROLES = ["SUPER_ADMIN", "MODERATOR", "CATALOG_MANAGER", "SUPPORT", "FINANCE"] as const;

function isStaff(roles: readonly string[]): boolean {
  return roles.some((role) => STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]));
}

function AdminPanelLayout() {
  const signedIn = useIsAuthenticated();
  const me = useMe();

  if (!signedIn) return <SignInRequired />;

  if (me.isPending) {
    return (
      <Page>
        <div className="space-y-4">
          <LineSkeleton className="h-10 w-64" />
          <LineSkeleton className="h-64 w-full" />
        </div>
      </Page>
    );
  }

  if (me.isError) {
    return (
      <Page>
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </Page>
    );
  }

  if (!isStaff(me.data.roles)) return <NotStaff />;

  return <AdminNav />;
}

function NotStaff() {
  return (
    <Page>
      <EmptyState
        title="Ruxsat yo'q"
        subtitle="Bu bo'lim faqat AVTOQISM platformasi administratorlari uchun. Agar bu xato deb hisoblasangiz, qo'llab-quvvatlash xizmatiga murojaat qiling."
        action={
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Bosh sahifaga qaytish
          </Link>
        }
      />
    </Page>
  );
}

function AdminNav() {
  // Two counts sit on the sidebar because they are the only two things in the
  // whole panel that wait on a human: money asking to leave, and an advert
  // asking to go live.
  const payouts = useAdminPayouts();
  const pendingAds = useAdminCampaigns("PENDING_REVIEW");

  const payoutsWaiting = (payouts.data ?? []).filter((row) => row.status === "REQUESTED").length;
  const adsWaiting = (pendingAds.data ?? []).length;

  const items: PanelNavItem[] = [
    { to: "/admin", label: "Umumiy", icon: LayoutDashboard, exact: true },
    { to: "/admin/finance", label: "Moliya", icon: Wallet, badge: payoutsWaiting },
    { to: "/admin/sellers", label: "Sotuvchilar", icon: Store },
    { to: "/admin/orders", label: "Buyurtmalar", icon: ClipboardList },
    { to: "/admin/ads", label: "Reklama", icon: Megaphone, badge: adsWaiting },
    { to: "/admin/promotions", label: "Aksiyalar", icon: BadgePercent },
    { to: "/admin/system", label: "Tizim", icon: ShieldCheck },
  ];

  return (
    <PanelShell title="Admin panel" subtitle="AVTOQISM" items={items}>
      <Outlet />
    </PanelShell>
  );
}
