import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Car,
  Clapperboard,
  Home,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  User,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLang, useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";

function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex items-center rounded-md border border-border p-0.5">
      {(["uz", "ru"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={cn(
            "rounded-[5px] px-2 py-1 text-[11px] font-bold uppercase transition-colors",
            lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground",
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
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        navigate({ to: "/marketplace", search: { q: value || undefined } });
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("common.search")}
        className="h-10 w-full rounded-md border border-input bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-accent-electric"
      />
    </form>
  );
}

export function TopBar() {
  const t = useT();
  const { cartCount, activeVehicle } = useStore();

  const links = [
    { to: "/", label: t("nav.home") },
    { to: "/marketplace", label: t("nav.market") },
    { to: "/feed", label: t("nav.feed") },
    { to: "/garage", label: t("nav.garage") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-4 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary">
            <Car className="size-4 text-primary-foreground" strokeWidth={2.4} />
          </span>
          <span className="font-display text-lg font-extrabold tracking-[-0.04em]">MOTORA</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
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
              className="hidden items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold xl:flex"
            >
              <Car className="size-4 text-accent-electric" />
              {activeVehicle.model} {activeVehicle.year}
            </Link>
          )}
          <LangSwitch />
          <Link
            to="/cart"
            className="relative grid size-10 place-items-center rounded-md border border-border transition-colors hover:border-border-strong"
            aria-label={t("nav.cart")}
          >
            <ShoppingBag className="size-4" />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-accent-electric px-1 text-[11px] font-bold text-accent-electric-foreground">
                {cartCount}
              </span>
            )}
          </Link>
          <Link
            to="/orders"
            className="hidden size-10 place-items-center rounded-md border border-border lg:grid"
            aria-label={t("nav.orders")}
          >
            <Receipt className="size-4" />
          </Link>
          <Link
            to="/profile"
            className="hidden size-10 place-items-center rounded-md border border-border lg:grid"
            aria-label={t("nav.profile")}
          >
            <User className="size-4" />
          </Link>
        </div>
      </div>
      <div className="border-t border-border px-4 py-2 md:hidden">
        <SearchField />
      </div>
    </header>
  );
}

export function BottomNav() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/", icon: Home, label: t("nav.home"), exact: true },
    { to: "/feed", icon: Clapperboard, label: t("nav.feed"), exact: false },
    { to: "/garage/add", icon: Plus, label: t("nav.create"), exact: false, primary: true },
    { to: "/orders", icon: Receipt, label: t("nav.orders"), exact: false },
    { to: "/profile", icon: User, label: t("nav.profile"), exact: false },
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          if ("primary" in item && item.primary) {
            return (
              <Link key={item.to} to={item.to} className="flex items-center justify-center py-2">
                <span className="grid size-11 place-items-center rounded-xl bg-accent-electric">
                  <item.icon className="size-5 text-accent-electric-foreground" strokeWidth={2.6} />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" strokeWidth={active ? 2.4 : 1.9} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNodeLike;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="type-h2">{title}</h2>
        {subtitle && <p className="type-caption mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type ReactNodeLike = React.ReactNode;
