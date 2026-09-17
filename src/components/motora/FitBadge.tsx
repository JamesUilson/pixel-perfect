import { CheckCircle2, CircleAlert, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export type Fitment = "fit" | "nofit" | "unknown";

export function FitBadge({
  fitment,
  size = "sm",
  className,
}: {
  fitment: Fitment;
  size?: "sm" | "lg";
  className?: string;
}) {
  const t = useT();
  const config = {
    fit: {
      Icon: CheckCircle2,
      label: size === "lg" ? t("fit.yes") : t("fit.short"),
      tone: "bg-success/10 text-success border-success/25",
    },
    unknown: {
      Icon: CircleAlert,
      label: t("fit.check"),
      tone: "bg-warning/12 text-warning-foreground border-warning/35",
    },
    nofit: {
      Icon: CircleSlash,
      label: t("fit.no"),
      tone: "bg-muted text-muted-foreground border-border",
    },
  }[fitment];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-semibold",
        size === "lg" ? "px-3 py-2 text-sm" : "px-2 py-1 text-[11px]",
        config.tone,
        className,
      )}
    >
      <config.Icon className={size === "lg" ? "size-4" : "size-3.5"} strokeWidth={2.4} />
      {config.label}
    </span>
  );
}
