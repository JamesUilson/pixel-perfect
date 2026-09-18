import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CarFront,
  Compass,
  Heart,
  House,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import { useLang, useT } from "@/lib/i18n";
import { useMe } from "@/lib/query/auth";
import { useCart } from "@/lib/query/commerce";
import { useActiveVehicle } from "@/lib/query/garage";
import { cn } from "@/lib/utils";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="AVTOQISM bosh sahifa"
      className={cn(
        "font-display text-xl font-bold tracking-normal",
        inverse ? "text-feed-foreground" : "text-foreground",
      )}
    >
      AVTO<span className="text-primary">QISM</span>
    </Link>
  );
}

function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex items-center border border-border p-0.5">
      {(["uz", "ru"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn(
            "px-2 py-1 text-[11px] font-bold uppercase transition-colors",
            lang === l ? "bg-foreground text-background" : "text-muted-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function SearchField({ className }: { className?: string }) {
  const t = useT();
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        void navigate({ to: "/marketplace", search: { q: value || undefined } });
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        // type=search gives the field its proper role for assistive tech and a
        // "Search" key on mobile keyboards.
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("common.search")}
        aria-label={t("common.search")}
        className="h-11 w-full border border-input bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
      />
    </form>
  );
}

export function TopBar() {
  const t = useT();
  const cart = useCart();
  const me = useMe();
  const { activeVehicle } = useActiveVehicle();

  const itemCount = cart.data?.item_count ?? 0;

  const links = [
    { to: "/", label: t("nav.home"), exact: true },
    { to: "/marketplace", label: t("nav.market"), exact: false },
    { to: "/feed", label: t("nav.feed"), exact: false },
    { to: "/garage", label: t("nav.garage"), exact: false },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-[1440px] items-center gap-6 px-5 lg:px-10">
        <Brand />

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Asosiy navigatsiya">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.exact }}
              className="nav-link py-6 text-sm font-medium text-muted-foreground"
              activeProps={{ className: "nav-link py-6 text-sm font-semibold text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <SearchField className="hidden flex-1 md:block" />

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {activeVehicle && (
            <Link
              to="/garage"
              className="hidden items-center gap-2 border border-border px-3 py-2 text-xs font-semibold xl:flex"
            >
              <CarFront className="size-4 text-primary" />
              {activeVehicle.variant.display_name.split(" ").slice(0, 2).join(" ")}{" "}
              {activeVehicle.year}
            </Link>
          )}
          <LangSwitch />

          <Link
            to="/cart"
            className="relative grid size-11 place-items-center border border-border transition-colors hover:border-border-strong"
            aria-label={t("nav.cart")}
          >
            <ShoppingBag className="size-4" />
            {itemCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                {itemCount}
              </span>
            )}
          </Link>
          <Link
            to="/orders"
            className="hidden size-11 place-items-center border border-border lg:grid"
            aria-label={t("nav.orders")}
          >
            <Receipt className="size-4" />
          </Link>
          <Link
            to="/profile"
            className="hidden size-11 place-items-center border border-border lg:grid"
            aria-label={me.data ? t("nav.profile") : t("auth.login")}
          >
            <UserRound className="size-4" />
          </Link>
        </div>
      </div>

      <div className="border-t border-border px-5 py-2 md:hidden">
        <SearchField />
      </div>
    </header>
  );
}

export function BottomNav() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cart = useCart();
  const itemCount = cart.data?.item_count ?? 0;

  const items = [
    { to: "/", icon: House, label: t("nav.home"), exact: true, badge: 0 },
    { to: "/marketplace", icon: Compass, label: t("nav.market"), exact: false, badge: 0 },
    {
      to: "/garage/add",
      icon: Plus,
      label: t("nav.create"),
      exact: false,
      primary: true,
      badge: 0,
    },
    { to: "/cart", icon: ShoppingBag, label: t("nav.cart"), exact: false, badge: itemCount },
    { to: "/profile", icon: UserRound, label: t("nav.profile"), exact: false, badge: 0 },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Mobil navigatsiya"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          if ("primary" in item && item.primary) {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center justify-center py-2"
                aria-label={item.label}
              >
                <span className="grid size-11 place-items-center bg-primary">
                  <item.icon className="size-5 text-primary-foreground" strokeWidth={2.6} />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" strokeWidth={active ? 2.4 : 1.9} />
              {item.badge > 0 && (
                <span className="absolute right-[22%] top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {item.badge}
                </span>
              )}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export { SectionHead } from "./Page";
