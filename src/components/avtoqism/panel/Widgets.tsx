/**
 * The small parts every panel screen is built from.
 *
 * They exist so a table on the warehouse screen and a table on the payouts
 * screen are the same table, and so the twelve places that need a "download to
 * Excel" button all get the same one.
 */
import type { ReactNode } from "react";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { ApiError, tokens } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/* --- tables --------------------------------------------------------------- */
export function DataTable({
  head,
  children,
  empty,
  className,
}: {
  head: ReactNode[];
  children: ReactNode;
  /** Rendered instead of the table body when there is nothing to show. */
  empty?: ReactNode | undefined;
  className?: string | undefined;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  if (!hasRows && empty) {
    return <div className="px-5 py-14 text-center">{empty}</div>;
  }
  return (
    // A back-office table is wide by nature; scrolling it horizontally on a
    // phone beats hiding columns the person came to read.
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {head.map((cell, index) => (
              <th
                key={index}
                scope="col"
                className="type-label whitespace-nowrap px-4 py-3 text-left text-muted-foreground"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cn("border-b border-border last:border-0 hover:bg-muted/50", className)}>
      {children}
    </tr>
  );
}

export function Cell({
  children,
  numeric = false,
  className,
  colSpan,
}: {
  children: ReactNode;
  /** Right-aligned and tabular, so a column of figures lines up. */
  numeric?: boolean | undefined;
  className?: string | undefined;
  colSpan?: number | undefined;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-4 py-3 align-middle",
        numeric && "text-right font-medium tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}

/* --- controls -------------------------------------------------------------- */
export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "outline" && "border border-border-strong bg-card hover:bg-muted",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "danger" &&
          "border border-destructive/40 text-destructive hover:bg-destructive/10",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="type-label mb-1.5 block text-muted-foreground">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-destructive">{error}</span>
      ) : hint ? (
        <span className="type-caption mt-1 block">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-ring";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, "appearance-none pr-8", className)} {...props} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, props.className)} {...props} />;
}

/* --- badges ---------------------------------------------------------------- */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning" | "critical" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "good" && "bg-success-soft text-success",
        tone === "warning" && "bg-warning/15 text-warning-foreground",
        tone === "critical" && "bg-destructive/12 text-destructive",
        tone === "info" && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </span>
  );
}

/* --- export ----------------------------------------------------------------- */
/**
 * Download an Excel report.
 *
 * It cannot be a plain link: the export endpoints need the bearer token, so the
 * file is fetched, turned into a blob and handed to the browser. The filename
 * comes from the server's Content-Disposition, so what lands in Downloads is
 * what the API decided to call it rather than something guessed here.
 */
export function ExportButton({
  path,
  label = "Excelga yuklash",
  variant = "outline",
  size = "sm",
}: {
  path: string;
  label?: string | undefined;
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const base = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api/v1";
      const access = tokens.access();
      const response = await fetch(`${base}${path}`, {
        headers: access ? { Authorization: `Bearer ${access}` } : {},
      });
      if (!response.ok) {
        throw new ApiError(response.status, null, "Hisobotni yuklab bo'lmadi.");
      }
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = match?.[1] ?? "avtoqism.xlsx";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Yuklab bo'lmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <Button variant={variant} size={size} onClick={() => void download()} disabled={busy}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Download className="size-4" aria-hidden />
        )}
        {label}
      </Button>
      {error && <span className="mt-1 text-xs text-destructive">{error}</span>}
    </span>
  );
}

/* --- misc -------------------------------------------------------------------- */
export function RangePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  const options = [
    { days: 7, label: "7 kun" },
    { days: 30, label: "30 kun" },
    { days: 90, label: "90 kun" },
    { days: 365, label: "1 yil" },
  ];
  return (
    <div className="inline-flex border border-border bg-card" role="group" aria-label="Davr">
      {options.map((option) => (
        <button
          key={option.days}
          type="button"
          aria-pressed={value === option.days}
          onClick={() => onChange(option.days)}
          className={cn(
            "px-3 py-2 text-xs font-semibold transition-colors",
            value === option.days
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A dialog that is a plain element, not a portal — no focus traps to get wrong. */
export function Panel({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-border bg-card"
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-border bg-card px-5 py-4">
          <h3 className="type-h3">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Yopish">
            ✕
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
