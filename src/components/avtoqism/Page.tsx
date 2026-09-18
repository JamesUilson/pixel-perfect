import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Page({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-5 py-8 lg:px-10 lg:py-12", className)}>
      {children}
    </div>
  );
}

export function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string | undefined;
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="type-label mb-2 text-primary">{eyebrow}</p>}
        <h1 className="type-h1">{title}</h1>
        {subtitle && <p className="type-caption mt-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string | undefined;
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="type-label mb-2 text-primary">{eyebrow}</p>}
        <h2 className="type-h2">{title}</h2>
        {subtitle && <p className="type-caption mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="grid place-items-center border border-dashed border-border bg-card px-6 py-20 text-center">
      <h3 className="type-h3">{title}</h3>
      {subtitle && <p className="type-caption mt-2 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
