/**
 * The account button in the header.
 *
 * Signed out it is a link to the sign-in page and nothing else. Signed in it
 * opens a short menu whose contents depend on who you are: a buyer sees their
 * orders and profile, a seller sees their panel, an admin sees theirs. The
 * point is that nobody should have to know that the address is /seller — the
 * way into your own back office is a button where your name is.
 *
 * Role checks here decide what is *shown*. The server decides what is allowed,
 * on every call.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CarFront,
  ChevronDown,
  LayoutDashboard,
  LogIn,
  LogOut,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";

import { useLogout, useMe } from "@/lib/query/auth";
import { useMyStores } from "@/lib/query/seller";
import { useIsAuthenticated } from "@/lib/query/session";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Roles that may open the admin panel. Mirrors the server's STAFF_ROLES. */
const STAFF = ["SUPER_ADMIN", "MODERATOR", "CATALOG_MANAGER", "SUPPORT", "FINANCE"];

export function AccountMenu({ className }: { className?: string | undefined }) {
  const t = useT();
  const signedIn = useIsAuthenticated();
  const me = useMe();
  const stores = useMyStores();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  // Close on an outside click or on Escape. A menu you cannot dismiss without
  // navigating is worse than no menu.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /*
   * Branching on `me.data` alone was wrong in both directions: a signed-in
   * person saw the sign-in button for as long as `/auth/me` took to answer, and
   * a visitor whose only way to register was a link on the sign-in page had to
   * find that page from an unlabelled icon. The token decides, and the header
   * offers both doors.
   */
  if (!signedIn) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Link
          to="/login"
          className="inline-flex h-11 items-center border border-border px-3 text-sm font-semibold transition-colors hover:border-border-strong"
        >
          <LogIn className="size-4 lg:mr-2" />
          <span className="hidden lg:inline">{t("auth.login")}</span>
        </Link>
        {/* Hidden on a phone, where the bottom bar's Profil tab leads to the
            same two buttons and the header has no room for a second one. */}
        <Link
          to="/register"
          className="hidden h-11 items-center bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 lg:inline-flex"
        >
          {t("auth.register")}
        </Link>
      </div>
    );
  }

  // Signed in, but the account has not loaded yet: hold the space rather than
  // swapping one control for another as it arrives.
  if (!me.data) {
    return (
      <div
        aria-hidden
        className={cn("h-11 w-11 animate-pulse border border-border bg-muted lg:w-32", className)}
      />
    );
  }

  const user = me.data;
  const isStaff = user.roles.some((role) => STAFF.includes(role));
  const hasStore = (stores.data ?? []).length > 0;
  const isSeller = hasStore || user.roles.includes("SELLER");
  const label = user.full_name?.trim() || user.phone || user.email || "Hisob";
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div ref={wrapper} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-11 items-center gap-2 border border-border px-2 transition-colors hover:border-border-strong"
      >
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center bg-foreground text-[11px] font-bold text-background"
        >
          {initials || <UserRound className="size-3.5" />}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-medium lg:block">{label}</span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-50 w-60 border border-border bg-popover shadow-float"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold">{label}</p>
            {user.phone && <p className="type-caption truncate">{user.phone}</p>}
          </div>

          {/*
           * The panels come first when you have one. Someone who runs a store
           * opens this menu to get to their orders, not to change their avatar.
           */}
          {isStaff && (
            <MenuLink to="/admin" icon={ShieldCheck} onNavigate={() => setOpen(false)} accent>
              Admin panel
            </MenuLink>
          )}
          {isSeller && (
            <MenuLink to="/seller" icon={LayoutDashboard} onNavigate={() => setOpen(false)} accent>
              Sotuvchi paneli
            </MenuLink>
          )}
          {!isSeller && !isStaff && (
            <MenuLink to="/seller/onboard" icon={Store} onNavigate={() => setOpen(false)}>
              Do'kon ochish
            </MenuLink>
          )}

          <div className="border-t border-border">
            <MenuLink to="/profile" icon={UserRound} onNavigate={() => setOpen(false)}>
              Shaxsiy kabinet
            </MenuLink>
            <MenuLink to="/orders" icon={Receipt} onNavigate={() => setOpen(false)}>
              {t("nav.orders")}
            </MenuLink>
            {/*
             * The balance sits with the buyer's own things, not the seller's:
             * it is the money they put in, and the only way to reach it.
             */}
            <MenuLink to="/wallet" icon={Wallet} onNavigate={() => setOpen(false)}>
              Hisobim
            </MenuLink>
            <MenuLink to="/garage" icon={CarFront} onNavigate={() => setOpen(false)}>
              {t("nav.garage")}
            </MenuLink>
            <MenuLink to="/settings" icon={Settings} onNavigate={() => setOpen(false)}>
              {t("settings.title")}
            </MenuLink>
          </div>

          <div className="border-t border-border">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                logout.mutate();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-muted"
            >
              <LogOut className="size-4" aria-hidden />
              Chiqish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  to,
  icon: Icon,
  children,
  onNavigate,
  accent = false,
}: {
  to: string;
  icon: typeof UserRound;
  children: React.ReactNode;
  onNavigate: () => void;
  accent?: boolean | undefined;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-muted",
        accent ? "font-semibold text-primary" : "text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </Link>
  );
}
