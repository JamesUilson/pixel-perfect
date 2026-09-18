import type { OrderStatus } from "@/lib/api/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** One colour language for order state, used in the list, the detail and the feed. */
const TONE: Record<string, string> = {
  PENDING: "border-warning/40 bg-warning/10 text-warning-foreground",
  CONFIRMED: "border-primary/30 bg-primary/10 text-primary",
  PREPARING: "border-primary/30 bg-primary/10 text-primary",
  SHIPPED: "border-primary/40 bg-primary/15 text-primary",
  DELIVERED: "border-success/30 bg-success-soft text-success",
  COMPLETED: "border-success/30 bg-success-soft text-success",
  CANCELLED: "border-border bg-muted text-muted-foreground",
  REFUNDED: "border-border bg-muted text-muted-foreground",
  DISPUTED: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
        TONE[status] ?? TONE["PENDING"],
      )}
    >
      {t(`orders.status.${status}`)}
    </span>
  );
}
