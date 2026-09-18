/**
 * Loading, error and empty states.
 *
 * Every network-backed surface uses these three, so the app never shows a blank
 * screen, a raw stack trace, or an English message to an Uzbek user.
 */
import { AlertTriangle, RefreshCw } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col border border-border bg-card">
      <div className="aspect-square animate-pulse bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-20 animate-pulse bg-muted" />
        <div className="h-4 w-full animate-pulse bg-muted" />
        <div className="h-4 w-2/3 animate-pulse bg-muted" />
        <div className="h-9 w-full animate-pulse bg-muted" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-8">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function LineSkeleton({ className }: { className?: string | undefined }) {
  return <div className={cn("h-4 animate-pulse bg-muted", className)} />;
}

/**
 * Renders a failure the way a person can act on it: the server's Uzbek message
 * when there is one, a generic line when there is not, and a retry button.
 * Internal detail (status, incident id) is only shown outside production.
 */
export function ErrorState({
  error,
  onRetry,
  compact = false,
}: {
  error: unknown;
  onRetry?: (() => void) | undefined;
  compact?: boolean | undefined;
}) {
  const t = useT();
  const apiError = error instanceof ApiError ? error : null;
  const message = apiError?.message ?? t("error.generic");
  const showDetail = import.meta.env.DEV && apiError;

  return (
    <div
      role="alert"
      className={cn(
        "grid place-items-center border border-destructive/25 bg-destructive/5 text-center",
        compact ? "px-4 py-8" : "px-6 py-16",
      )}
    >
      <AlertTriangle className="mb-3 size-6 text-destructive" />
      <p className="max-w-md font-semibold">{message}</p>
      {showDetail && (
        <p className="type-caption mt-2 font-mono text-xs">
          {apiError.status} · {apiError.code}
          {apiError.incidentId ? ` · ${apiError.incidentId}` : ""}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 border border-border-strong bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
        >
          <RefreshCw className="size-4" />
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}

export function InlineSpinner({ label }: { label?: string | undefined }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <RefreshCw className="size-4 animate-spin" />
      {label ?? t("common.loading")}
    </span>
  );
}
