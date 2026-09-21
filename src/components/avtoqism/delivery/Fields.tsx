/**
 * The form parts the delivery screens share.
 *
 * They are copies of what `checkout.tsx` already drew inline, lifted so the
 * address book on the profile screen is the same form, pixel for pixel, rather
 * than a second one that drifts.
 */
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function FormSection({
  legend,
  children,
  className,
}: {
  legend: string;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <fieldset className={cn("border border-border bg-card p-6", className)}>
      <legend className="type-label px-2 text-muted-foreground">{legend}</legend>
      {children}
    </fieldset>
  );
}

export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  required,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  placeholder?: string | undefined;
  autoComplete?: string | undefined;
  inputMode?: "text" | "tel" | "numeric" | "decimal" | undefined;
  maxLength?: number | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
}) {
  // Generated rather than derived from the label: the same label appears on
  // checkout and in the address book, and duplicate ids break every `htmlFor`.
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("block", className)}>
      <label className="type-label text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(
          "mt-2 h-12 w-full border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary disabled:opacity-60",
          error ? "border-destructive" : "border-input",
        )}
      />
      {error ? (
        <span
          id={`${id}-error`}
          role="alert"
          className="mt-1 block text-xs font-semibold text-destructive"
        >
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="type-caption mt-1 block">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function ChoiceRow({
  name,
  label,
  description,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  description?: string | undefined;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 border px-4 py-3.5 text-sm font-semibold transition-colors",
        checked ? "border-primary bg-primary/5" : "border-border hover:border-border-strong",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
      />
      <span className="min-w-0">
        <span className="block">{label}</span>
        {description && (
          <span className="type-caption mt-0.5 block font-normal">{description}</span>
        )}
      </span>
    </label>
  );
}

/** A refusal the buyer can act on, in the tone of the surrounding card. */
export function Notice({
  tone,
  title,
  children,
  action,
}: {
  tone: "info" | "warning" | "danger";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "border p-4",
        tone === "info" && "border-primary/30 bg-primary/5",
        tone === "warning" && "border-warning/40 bg-warning/10",
        tone === "danger" && "border-destructive/30 bg-destructive/5",
      )}
    >
      <p className={cn("text-sm font-semibold", tone === "danger" && "text-destructive")}>
        {title}
      </p>
      {children && <div className="type-caption mt-1">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
