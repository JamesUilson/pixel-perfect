/**
 * The parts every settings section is built from.
 *
 * One vocabulary for the whole screen, so that seven sections written over an
 * afternoon read as one screen: a card with a heading, rows inside it, and
 * exactly three kinds of control — a choice between two or three options, a
 * switch, and a button. Anything that needed a fourth kind has been reworded
 * until it did not.
 *
 * The visual language is the storefront's, not the seller panel's: hairline
 * borders on `--card`, sharp corners, the display face for headings, the accent
 * used once per card at most. Nothing here invents a colour — every value is a
 * token from `styles.css`.
 */
import type { ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/* --- the card ------------------------------------------------------------- */
export function SettingsCard({
  id,
  icon: Icon,
  title,
  subtitle,
  children,
  footer,
}: {
  /** Also the scroll target the section nav jumps to. */
  id: string;
  icon: typeof Check;
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
}) {
  return (
    <section
      id={id}
      // `scroll-mt` keeps the heading clear of the sticky header when the nav
      // above jumps here; without it the title lands underneath the top bar.
      className="scroll-mt-28 border border-border bg-card"
      aria-labelledby={`${id}-title`}
    >
      <header className="flex items-start gap-3 border-b border-border px-5 py-4 lg:px-6">
        <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center bg-muted">
          <Icon className="size-4 text-primary" />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="type-h3">
            {title}
          </h2>
          {subtitle && <p className="type-caption mt-1">{subtitle}</p>}
        </div>
      </header>

      <div className="divide-y divide-border">{children}</div>

      {footer && (
        <div className="border-t border-border bg-muted/40 px-5 py-4 lg:px-6">{footer}</div>
      )}
    </section>
  );
}

/**
 * A row: what the setting is on the left, the control on the right.
 *
 * It stacks on a phone rather than squeezing, because a label truncated to
 * "Yozuvni katta…" beside a switch is a setting nobody can be sure they are
 * changing.
 */
export function SettingRow({
  label,
  hint,
  htmlFor,
  control,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode | undefined;
  /** Set when the control is a single input, so the label clicks through to it. */
  htmlFor?: string | undefined;
  /** Rendered on the same line as the label, right-aligned. */
  control?: ReactNode | undefined;
  /** Rendered below, full width — for a choice group or an open form. */
  children?: ReactNode | undefined;
  className?: string | undefined;
}) {
  const heading = (
    <>
      <span className="block text-sm font-semibold">{label}</span>
      {hint && <span className="type-caption mt-1 block">{hint}</span>}
    </>
  );

  return (
    <div className={cn("px-5 py-4 lg:px-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          {htmlFor ? (
            <label htmlFor={htmlFor} className="cursor-pointer">
              {heading}
            </label>
          ) : (
            heading
          )}
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/* --- controls -------------------------------------------------------------- */
/**
 * A choice between a handful of options, as one connected group.
 *
 * A radio group rather than a select: two or three options are faster to read
 * than to open, and the current answer is visible without a tap. Real radio
 * inputs, hidden behind the labels, so the arrow keys and the screen reader both
 * behave without a line of JavaScript.
 */
export function ChoiceGroup<T extends string>({
  name,
  value,
  options,
  onChange,
  className,
}: {
  name: string;
  value: T;
  options: readonly { value: T; label: string; hint?: string | undefined; icon?: ReactNode }[];
  onChange: (value: T) => void;
  className?: string | undefined;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn("grid gap-px bg-border sm:grid-cols-3", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "relative flex cursor-pointer flex-col gap-1 bg-card p-4 transition-colors",
              selected ? "bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="flex items-center gap-2 text-sm font-semibold">
              {option.icon}
              {option.label}
              {selected && <Check className="ml-auto size-4" aria-hidden />}
            </span>
            {option.hint && (
              <span className={cn("text-xs", selected ? "opacity-80" : "text-muted-foreground")}>
                {option.hint}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

/**
 * A switch.
 *
 * A real checkbox under a drawn track, so `aria-checked`, the space bar and
 * focus-visible all come for free. The knob moves with a transition that the
 * reduced-motion preference itself switches off — which is a small joke the
 * stylesheet gets to make.
 */
export function Switch({
  id,
  checked,
  onChange,
  label,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** For assistive technology; the visible label is the row's. */
  label: string;
  disabled?: boolean | undefined;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center border transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        checked ? "border-primary bg-primary" : "border-border-strong bg-muted",
      )}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0.5 size-5 transition-transform",
          checked ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-surface",
        )}
      />
      {/* The focus ring belongs to the visible track, not to the hidden input. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-1 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-ring"
      />
    </label>
  );
}

/** A small toggle used inside the notification grid, where a track is too wide. */
export function CheckChip({
  id,
  checked,
  onChange,
  label,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean | undefined;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex select-none items-center gap-2 border px-3 py-2 text-xs font-semibold transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        checked
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "grid size-4 shrink-0 place-items-center border",
          checked ? "border-background/50" : "border-border-strong",
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
      {label}
    </label>
  );
}

export function ActionButton({
  children,
  variant = "outline",
  busy = false,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * `danger` is the outlined form that *opens* a destructive flow; `destructive`
   * is the solid form that *commits* one. The two are deliberately different: a
   * solid red button on a quiet settings row reads as the danger, and an
   * outlined one inside the confirmation reads as a suggestion.
   */
  variant?: "primary" | "outline" | "quiet" | "danger" | "destructive" | undefined;
  busy?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
        variant === "outline" && "border border-border-strong bg-card hover:bg-muted",
        variant === "quiet" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "danger" &&
          "border border-destructive/50 text-destructive hover:bg-destructive/10",
        variant === "destructive" && "bg-destructive text-destructive-foreground hover:opacity-90",
        className,
      )}
      {...props}
    >
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function FieldInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  error,
  hint,
  autoComplete,
  inputMode,
  placeholder,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
  autoComplete?: string | undefined;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] | undefined;
  placeholder?: string | undefined;
  maxLength?: number | undefined;
}) {
  return (
    <div>
      <label htmlFor={id} className="type-label block text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        className={cn(
          "mt-2 h-12 w-full border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary",
          error ? "border-destructive" : "border-input",
        )}
      />
      {error ? (
        <p role="alert" className="mt-1 text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="type-caption mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

/** The server's refusal, in its own words. Never paraphrased. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive"
    >
      {children}
    </p>
  );
}

export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-success">
      <Check className="size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/**
 * The confirmation an irreversible action has to pass through.
 *
 * It opens in place rather than in a dialog, for the reason the payout-card list
 * already settled on: the thing being destroyed stays visible next to the
 * question, so "end this session" cannot be answered about the wrong row. The
 * destructive button is never the first thing under the thumb.
 */
export function DangerConfirm({
  question,
  detail,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  question: string;
  detail?: ReactNode | undefined;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean | undefined;
  onConfirm: () => void;
  onCancel: () => void;
  /** An extra step before the button — a password, a reason. */
  children?: ReactNode | undefined;
}) {
  return (
    <div className="border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-destructive">{question}</p>
      {detail && <div className="type-caption mt-2">{detail}</div>}
      {children && <div className="mt-4">{children}</div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton variant="destructive" busy={busy} disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </ActionButton>
        <ActionButton variant="quiet" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </ActionButton>
      </div>
    </div>
  );
}
