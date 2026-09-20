/**
 * Dashboard charts.
 *
 * Every chart here follows the same contract, so twelve charts read as one
 * system rather than twelve decisions:
 *
 *   - one y-scale, always. Two measures of different magnitude get two charts;
 *   - 2px lines, ≤24px bars with a 4px rounded cap and a 2px surface gap
 *     between neighbours, area washes at 10%;
 *   - a legend whenever there are two or more series, and none when there is
 *     one — the title already says what is plotted;
 *   - a hover tooltip on every plot, because an on-screen chart is interactive
 *     and the axis cannot carry every value;
 *   - gridlines and axis text one step off the surface, so the data is the
 *     only loud thing.
 *
 * Numbers arrive from the API as strings (the server sends exact decimals, not
 * floats) and are converted once, here, at the edge of the chart.
 */
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompact, formatSom, groupDigits } from "@/lib/format";
import { VIZ_AXIS, VIZ_GRID, VIZ_SURFACE, vizColor } from "@/lib/viz";
import { cn } from "@/lib/utils";

export const num = (value: string | number | null | undefined): number => {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** "2026-09-18" -> "18.09". Short enough that ticks never collide. */
function shortDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return day && month ? `${day}.${month}` : iso;
}

const axisProps = {
  stroke: VIZ_AXIS,
  tick: { fill: VIZ_AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/* --- shell -------------------------------------------------------------- */
export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
  height = 260,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  height?: number | undefined;
}) {
  return (
    <section className={cn("border border-border bg-card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="type-h3">{title}</h3>
          {subtitle && <p className="type-caption mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      {/*
       * A plain sized box, not a ResponsiveContainer. The container measures
       * its parent and clones its child to inject width and height, so it has
       * to sit immediately around the Recharts element — one layer of our own
       * components in between and the chart is handed props it ignores and
       * renders at zero size. Each chart below therefore brings its own.
       */}
      <div style={{ height }}>{children}</div>
    </section>
  );
}

/** Every chart is wrapped here, next to its Recharts element and nowhere else. */
function Responsive({ children }: { children: ReactNode }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {children as never}
    </ResponsiveContainer>
  );
}

/**
 * The tooltip.
 *
 * Values wear text tokens; identity comes from the colour chip beside them.
 * Colouring the number itself would make a light hue unreadable on the card.
 */
function VizTooltip({
  active,
  payload,
  label,
  money = true,
}: {
  active?: boolean | undefined;
  payload?: readonly { name?: string; value?: number; color?: string }[] | undefined;
  label?: string | undefined;
  money?: boolean | undefined;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-popover px-3 py-2 shadow-float">
      {label && <p className="type-label mb-2 text-muted-foreground">{label}</p>}
      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0"
              style={{ background: entry.color ?? vizColor(index) }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums">
              {money ? formatSom(entry.value ?? 0) : groupDigits(entry.value ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const legendProps = {
  iconType: "square",
  iconSize: 10,
  wrapperStyle: { fontSize: 12, paddingTop: 12 },
} as const;

/* --- time series --------------------------------------------------------- */
export function RevenueArea({
  data,
  valueKey = "revenue",
  name = "Savdo",
}: {
  data: Record<string, unknown>[];
  valueKey?: string | undefined;
  name?: string | undefined;
}) {
  return (
    <Responsive>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="viz-area-1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={vizColor(0)} stopOpacity={0.18} />
            <stop offset="100%" stopColor={vizColor(0)} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={VIZ_GRID} vertical={false} />
        <XAxis dataKey="day" tickFormatter={shortDay} minTickGap={24} {...axisProps} />
        <YAxis tickFormatter={formatCompact} width={52} {...axisProps} />
        <Tooltip
          content={<VizTooltip />}
          cursor={{ stroke: VIZ_AXIS, strokeWidth: 1 }}
          labelFormatter={shortDay}
        />
        <Area
          type="monotone"
          dataKey={(row: Record<string, unknown>) => num(row[valueKey] as string)}
          name={name}
          stroke={vizColor(0)}
          strokeWidth={2}
          fill="url(#viz-area-1)"
          // A dot per day turns a month into a dotted mess; the crosshair carries
          // the per-day value instead.
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: VIZ_SURFACE }}
        />
      </AreaChart>
    </Responsive>
  );
}

export function MultiLine({
  data,
  series,
  money = true,
}: {
  data: Record<string, unknown>[];
  series: { key: string; name: string }[];
  money?: boolean | undefined;
}) {
  return (
    <Responsive>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={VIZ_GRID} vertical={false} />
        <XAxis dataKey="day" tickFormatter={shortDay} minTickGap={24} {...axisProps} />
        <YAxis tickFormatter={formatCompact} width={52} {...axisProps} />
        <Tooltip
          content={<VizTooltip money={money} />}
          cursor={{ stroke: VIZ_AXIS, strokeWidth: 1 }}
          labelFormatter={shortDay}
        />
        {series.length > 1 && <Legend {...legendProps} />}
        {series.map((s, index) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={(row: Record<string, unknown>) => num(row[s.key] as string)}
            name={s.name}
            stroke={vizColor(index)}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: VIZ_SURFACE }}
          />
        ))}
      </LineChart>
    </Responsive>
  );
}

export function StackedBars({
  data,
  series,
  money = true,
}: {
  data: Record<string, unknown>[];
  series: { key: string; name: string }[];
  money?: boolean | undefined;
}) {
  return (
    <Responsive>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={VIZ_GRID} vertical={false} />
        <XAxis dataKey="day" tickFormatter={shortDay} minTickGap={24} {...axisProps} />
        <YAxis tickFormatter={formatCompact} width={52} {...axisProps} />
        <Tooltip
          content={<VizTooltip money={money} />}
          cursor={{ fill: VIZ_GRID, fillOpacity: 0.4 }}
          labelFormatter={shortDay}
        />
        {series.length > 1 && <Legend {...legendProps} />}
        {series.map((s, index) => (
          <Bar
            key={s.key}
            dataKey={(row: Record<string, unknown>) => num(row[s.key] as string)}
            name={s.name}
            stackId="a"
            maxBarSize={24}
            fill={vizColor(index)}
            // The 2px gap in the surface colour is what separates the segments;
            // a stroke around each one would add ink that is not data.
            stroke={VIZ_SURFACE}
            strokeWidth={2}
          />
        ))}
      </BarChart>
    </Responsive>
  );
}

/* --- categorical --------------------------------------------------------- */
export function HorizontalBars({
  data,
  labelKey,
  valueKey,
  money = true,
  colorIndex = 0,
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  money?: boolean | undefined;
  colorIndex?: number | undefined;
}) {
  return (
    <Responsive>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        barCategoryGap="30%"
      >
        <CartesianGrid stroke={VIZ_GRID} horizontal={false} />
        <XAxis type="number" tickFormatter={formatCompact} {...axisProps} />
        <YAxis
          type="category"
          dataKey={labelKey}
          width={148}
          {...axisProps}
          tick={{ fill: "var(--color-foreground)", fontSize: 12 }}
        />
        <Tooltip
          content={<VizTooltip money={money} />}
          cursor={{ fill: VIZ_GRID, fillOpacity: 0.4 }}
        />
        <Bar
          dataKey={(row: Record<string, unknown>) => num(row[valueKey] as string)}
          name={money ? "Savdo" : "Soni"}
          maxBarSize={20}
          fill={vizColor(colorIndex)}
          // Rounded at the data end, square where it meets the baseline.
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </Responsive>
  );
}

/**
 * A donut, used only where the parts genuinely make a whole — order statuses,
 * category share. Never for things that merely happen to be a list.
 */
export function DonutChart({
  data,
  money = false,
}: {
  data: { name: string; value: number }[];
  money?: boolean | undefined;
}) {
  return (
    <Responsive>
      <PieChart>
        <Tooltip content={<VizTooltip money={money} />} />
        <Legend {...legendProps} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          stroke={VIZ_SURFACE}
          strokeWidth={2}
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={vizColor(index)} />
          ))}
        </Pie>
      </PieChart>
    </Responsive>
  );
}

/* --- figures ------------------------------------------------------------- */
export function StatTile({
  label,
  value,
  delta,
  hint,
  deltaGoodWhenUp = true,
  icon,
}: {
  label: string;
  value: string;
  /** Percentage change against the previous window of the same length. */
  delta?: number | null | undefined;
  hint?: string | undefined;
  deltaGoodWhenUp?: boolean | undefined;
  icon?: ReactNode | undefined;
}) {
  // Zero means "no baseline to compare against", not "flat" — the service
  // returns 0 when the previous window was empty, and a dash is the honest
  // rendering of that.
  const showDelta = typeof delta === "number" && delta !== 0;
  const good = showDelta && delta > 0 === deltaGoodWhenUp;

  return (
    <div className="border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="type-label text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      {/* Proportional figures: tabular-nums makes a display-size number loose. */}
      <p className="font-display text-[1.75rem] font-semibold leading-none tracking-tight">
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {showDelta ? (
          <span className={cn("text-xs font-semibold", good ? "text-success" : "text-destructive")}>
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        {hint && <span className="type-caption">{hint}</span>}
      </div>
    </div>
  );
}

/**
 * A meter, for one value against a ceiling — a campaign's budget, a shelf
 * against its alert level. The track is a lighter step of the fill's own hue,
 * so the state reads across the whole bar rather than only where it is filled.
 */
export function Meter({
  value,
  max,
  label,
  tone = "neutral",
}: {
  value: number;
  max: number;
  label?: string | undefined;
  tone?: "neutral" | "warning" | "critical" | undefined;
}) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  const fill =
    tone === "critical"
      ? "var(--color-destructive)"
      : tone === "warning"
        ? "var(--color-warning)"
        : vizColor(0);
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-semibold tabular-nums">{pct}%</span>
        </div>
      )}
      <div
        className="h-1.5 w-full bg-muted"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "progress"}
      >
        <div className="h-full" style={{ width: `${pct}%`, background: fill }} />
      </div>
    </div>
  );
}
