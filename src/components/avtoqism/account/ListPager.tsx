/**
 * Paging for the account's own lists.
 *
 * The admin panel has a pager already, and it is built from the panel's widget
 * vocabulary — a different visual language from the storefront, which is what
 * the profile screen is written in. This one is the same control in the
 * storefront's terms: hairline borders, sharp corners, the plain type scale.
 *
 * The count is part of it rather than decoration. "11–20 / 34" is how somebody
 * knows there is more behind the button, and how they know a row they just
 * removed actually went.
 */
import { groupDigits } from "@/lib/format";

export function ListPager({
  page,
  size,
  total,
  pages,
  busy = false,
  label,
  onChange,
}: {
  page: number;
  size: number;
  total: number;
  pages: number;
  busy?: boolean | undefined;
  /** Names the list for assistive technology: there are two on this screen. */
  label: string;
  onChange: (page: number) => void;
}) {
  // One page is no choice to make, so there is nothing to draw.
  if (total === 0 || pages <= 1) return null;

  const first = (page - 1) * size + 1;
  const last = Math.min(page * size, total);

  return (
    <nav
      aria-label={label}
      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
    >
      <p className="type-caption tabular-nums" aria-live="polite">
        {groupDigits(first)}–{groupDigits(last)} / {groupDigits(total)}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || busy}
          onClick={() => onChange(page - 1)}
          className="border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
        >
          Oldingi
        </button>
        <span className="type-caption tabular-nums">
          {groupDigits(page)} / {groupDigits(pages)}
        </span>
        <button
          type="button"
          disabled={page >= pages || busy}
          onClick={() => onChange(page + 1)}
          className="border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
        >
          Keyingi
        </button>
      </div>
    </nav>
  );
}
