import { CheckCircle2, CircleAlert, CircleSlash } from "lucide-react";

import type { CompatibilityOut } from "@/lib/api/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Fitment badge.
 *
 * Compatibility is never a boolean here: the server sends a status *and* the
 * source that produced it, and the large variant shows the source, because
 * "the manufacturer says so" and "a seller says so" are not the same promise.
 */
export function FitBadge({
  compatibility,
  size = "sm",
  className,
}: {
  compatibility: CompatibilityOut | null | undefined;
  size?: "sm" | "lg" | undefined;
  className?: string | undefined;
}) {
  const t = useT();
  if (!compatibility) return null;

  const config = {
    COMPATIBLE: {
      Icon: CheckCircle2,
      label: size === "lg" ? t("fit.yes") : t("fit.short"),
      tone: "border-success/30 bg-success-soft text-success",
    },
    REQUIRES_VERIFICATION: {
      Icon: CircleAlert,
      label: t("fit.check"),
      tone: "border-warning/40 bg-warning/10 text-warning-foreground",
    },
    NOT_COMPATIBLE: {
      Icon: CircleSlash,
      label: t("fit.no"),
      tone: "border-border bg-muted text-muted-foreground",
    },
  }[compatibility.status];

  const sourceLabel = t(`fit.source.${compatibility.source}`);

  if (size === "lg") {
    return (
      <div className={cn("border p-5", config.tone, className)}>
        <div className="flex items-start gap-3">
          <config.Icon className="mt-0.5 size-5 shrink-0" strokeWidth={2.4} />
          <div>
            <p className="type-label">{config.label}</p>
            <p className="type-caption mt-1 text-current opacity-80">{sourceLabel}</p>
            {compatibility.note_uz && (
              <p className="type-caption mt-2 text-current opacity-80">{compatibility.note_uz}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <span
      title={sourceLabel}
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] font-semibold",
        config.tone,
        className,
      )}
    >
      <config.Icon className="size-3.5" strokeWidth={2.4} />
      {config.label}
    </span>
  );
}
