/**
 * The frame both control panels sit in.
 *
 * A marketplace back office is a different mode of use from the storefront: it
 * is a workbench someone sits at for an hour, not a shop they browse. So it
 * gets a persistent sidebar on desktop and a scrolling tab strip on phones,
 * rather than the storefront's bottom bar — but it keeps the same tokens, the
 * same sharp corners and the same type scale, so it still reads as AVTOQISM.
 */
import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type PanelNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown as a small count beside the label — orders waiting, low stock. */
  badge?: number | undefined;
  exact?: boolean | undefined;
};

export function PanelShell({
  title,
  subtitle,
  items,
  children,
  toolbar,
}: {
  title: string;
  subtitle?: string | undefined;
  items: PanelNavItem[];
  children: ReactNode;
  toolbar?: ReactNode | undefined;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (item: PanelNavItem) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.to);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-label mb-2 text-primary">{subtitle ?? "AVTOQISM"}</p>
          <h1 className="type-h1">{title}</h1>
        </div>
        {toolbar}
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/*
         * On a phone the sidebar becomes a horizontal strip that scrolls. It
         * keeps every destination reachable in one tap without a hamburger,
         * which is the thing people actually complain about in back offices.
         */}
        <nav
          aria-label={title}
          className={cn(
            "no-scrollbar -mx-4 flex shrink-0 gap-1 overflow-x-auto px-4 pb-1",
            "lg:mx-0 lg:w-56 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0",
          )}
        >
          {items.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors",
                  "lg:w-full lg:shrink",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span>{item.label}</span>
                {item.badge ? (
                  <span
                    className={cn(
                      "ml-auto min-w-5 px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums",
                      active ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground",
                    )}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** A row of filters and actions above a screen's content. */
export function PanelToolbar({ children }: { children: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-center gap-2">{children}</div>;
}

export function PanelSection({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string | undefined;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={cn("border border-border bg-card", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            {title && <h3 className="type-h3">{title}</h3>}
            {subtitle && <p className="type-caption mt-1">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
