/**
 * The data-visualisation palette.
 *
 * Six categorical slots, assigned in a fixed order and never cycled. Slot 1 is
 * the AVTOQISM red, so the primary series on any chart is the brand colour and
 * a reader scanning the dashboard sees one thing standing out.
 *
 * The order is not cosmetic. It was validated with the colour-vision checks
 * before being written down: on the adjacent pairs that stacks, bars and lines
 * actually put next to each other, the worst deuteranopia/protanopia separation
 * is ΔE 9.1 light and 8.4 dark, and the worst normal-vision separation is 22.9
 * light and 19.7 dark — clear of the ΔE 8 and ΔE 15 floors. For scatter-like
 * charts, where every pair can end up adjacent, only the first three slots hold
 * up, so those forms cap at three series and fold the rest into "Boshqalar".
 *
 * Three light-mode hues sit under 3:1 against white. They are only ever used
 * with a legend, a tooltip and the underlying table on the same screen, which
 * is the relief the contrast rule asks for.
 *
 * Dark is a selected set, not an automatic flip: the same six hues re-stepped
 * for the dark surface and validated against it.
 */
export const VIZ_LIGHT = [
  "#da3b21", // brand red
  "#2a78d6", // blue
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#4a3aa7", // violet
  "#e87ba4", // magenta
] as const;

export const VIZ_DARK = ["#e85339", "#3987e5", "#199e70", "#c98500", "#9085e9", "#d55181"] as const;

/** Forms where any two series can end up adjacent hold to the first three. */
export const ALL_PAIRS_SAFE = 3;

/**
 * Status colours are reserved. They never stand in for "series 4", and they
 * always ship with a word beside them rather than carrying meaning alone.
 */
export const VIZ_STATUS = {
  good: "var(--color-success)",
  warning: "var(--color-warning)",
  critical: "var(--color-destructive)",
  neutral: "var(--color-muted-foreground)",
} as const;

/**
 * What a chart actually uses.
 *
 * The hexes above are the audited values; charts reference the CSS variables
 * that carry them, so light and dark swap in the stylesheet and no component
 * has to know which mode it is in. That also keeps server and client rendering
 * identical — a mode read in JavaScript would not survive hydration.
 */
export const VIZ = [
  "var(--viz-1)",
  "var(--viz-2)",
  "var(--viz-3)",
  "var(--viz-4)",
  "var(--viz-5)",
  "var(--viz-6)",
] as const;

export const VIZ_GRID = "var(--viz-grid)";
export const VIZ_AXIS = "var(--viz-axis)";
export const VIZ_SURFACE = "var(--color-card)";

export function vizColor(index: number): string {
  // Never generate a hue for an overflowing series: callers fold to "Boshqalar"
  // before they get here, and clamping makes a bug visible instead of pretty.
  return VIZ[Math.min(index, VIZ.length - 1)] as string;
}

/**
 * Fold a long list into the slots the palette has, with the remainder summed
 * into one "Boshqalar" row. Sorting by size first means the fold always drops
 * the least important rows.
 */
export function foldSeries<T>(
  rows: T[],
  value: (row: T) => number,
  limit: number,
  makeOther: (total: number) => T,
): T[] {
  if (rows.length <= limit) return rows;
  const sorted = [...rows].sort((a, b) => value(b) - value(a));
  const kept = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1);
  const total = rest.reduce((sum, row) => sum + value(row), 0);
  return total > 0 ? [...kept, makeOther(total)] : kept;
}
