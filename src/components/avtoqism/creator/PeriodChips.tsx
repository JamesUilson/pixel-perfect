/**
 * The four windows the statistics screen offers.
 *
 * Not `RangePicker`: that one speaks in days and the server refuses anything
 * outside 7 / 30 / 90 / all, so the control offers exactly the four the API
 * accepts rather than a fifth that would come back a 422.
 */
import type { StatsWindow } from "@/lib/query/seller";
import { cn } from "@/lib/utils";

const OPTIONS: { value: StatsWindow; label: string }[] = [
  { value: "7", label: "7 kun" },
  { value: "30", label: "30 kun" },
  { value: "90", label: "90 kun" },
  { value: "all", label: "Barcha" },
];

export function windowLabel(window: StatsWindow): string {
  return OPTIONS.find((option) => option.value === window)?.label ?? window;
}

export function PeriodChips({
  value,
  onChange,
}: {
  value: StatsWindow;
  onChange: (window: StatsWindow) => void;
}) {
  return (
    <div className="inline-flex border border-border bg-card" role="group" aria-label="Davr">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3.5 py-2 text-xs font-semibold transition-colors",
            value === option.value
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
