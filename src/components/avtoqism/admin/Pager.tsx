/**
 * Paging for the log tables.
 *
 * The count is part of the control, not decoration: "1–50 / 12 480" is how a
 * person knows whether the filter they typed actually narrowed anything.
 */
import { Button } from "@/components/avtoqism/panel/Widgets";
import { groupDigits } from "@/lib/format";

export function Pager({
  page,
  size,
  total,
  pages,
  busy = false,
  onChange,
}: {
  page: number;
  size: number;
  total: number;
  pages: number;
  busy?: boolean | undefined;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const first = (page - 1) * size + 1;
  const last = Math.min(page * size, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
      <p className="type-caption tabular-nums" aria-live="polite">
        {groupDigits(first)}–{groupDigits(last)} / {groupDigits(total)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1 || busy}
          onClick={() => onChange(page - 1)}
        >
          Oldingi
        </Button>
        <span className="type-caption tabular-nums">
          {groupDigits(page)} / {groupDigits(Math.max(pages, 1))}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages || busy}
          onClick={() => onChange(page + 1)}
        >
          Keyingi
        </Button>
      </div>
    </div>
  );
}
