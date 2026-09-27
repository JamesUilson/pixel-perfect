/**
 * A bar list: one row per part of a whole, each with its share.
 *
 * This is the form the approved design gives "Yosh toifasi" — a label, a bar
 * and a percentage on one line — reused for the breakdowns the data model can
 * actually answer. The bar itself is the panel's own `Meter`, so a share here
 * and a budget on the ads screen are the same object.
 */
import { Meter } from "@/components/avtoqism/panel/Charts";
import { groupDigits } from "@/lib/format";

export type ShareRow = { label: string; value: number };

export function ShareBars({
  rows,
  /** The denominator every row is a share of. Zero renders empty bars, not NaN. */
  total,
  note,
}: {
  rows: ShareRow[];
  total: number;
  note?: string | undefined;
}) {
  return (
    <div className="space-y-3.5">
      {rows.map((row) => (
        <Meter
          key={row.label}
          value={row.value}
          max={total}
          label={`${row.label} · ${groupDigits(row.value)}`}
        />
      ))}
      {note && <p className="type-caption">{note}</p>}
    </div>
  );
}
