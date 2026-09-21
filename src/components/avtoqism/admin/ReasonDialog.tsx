/**
 * The one dialog behind every admin decision that a person on the other end
 * will read about.
 *
 * Approving, rejecting, suspending and reinstating a store, and approving or
 * rejecting a payout, are the same interaction wearing different words: say
 * what is about to happen, take a reason, and do not let the button fire twice.
 * Keeping it in one place is what stops "rad etish" asking for a reason on one
 * screen and accepting an empty one on the next.
 */
import { useEffect, useState } from "react";

import { Button, Field, Panel } from "@/components/avtoqism/panel/Widgets";

export function ReasonDialog({
  open,
  title,
  /** What the action does, in the words the operator needs before committing. */
  consequence,
  subject,
  reasonLabel = "Sabab",
  reasonHint,
  placeholder,
  /** The server rejects anything under three characters on the required paths. */
  required = false,
  confirmLabel,
  danger = false,
  pending = false,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  consequence: React.ReactNode;
  subject?: React.ReactNode | undefined;
  reasonLabel?: string | undefined;
  reasonHint?: string | undefined;
  placeholder?: string | undefined;
  required?: boolean | undefined;
  confirmLabel: string;
  danger?: boolean | undefined;
  pending?: boolean | undefined;
  error?: string | null | undefined;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  // A dialog reused for four different moves must not carry the last one's
  // text into the next one.
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const tooShort = required && reason.trim().length < 3;

  return (
    <Panel open={open} title={title} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (tooShort || pending) return;
          onConfirm(reason.trim());
        }}
      >
        {subject && (
          <div className="border border-border bg-muted/40 px-4 py-3 text-sm">{subject}</div>
        )}

        <p className="type-caption">{consequence}</p>

        <Field
          label={required ? `${reasonLabel} — majburiy` : `${reasonLabel} — ixtiyoriy`}
          hint={reasonHint}
        >
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={placeholder}
            maxLength={500}
            rows={3}
            required={required}
            className="w-full resize-y border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-ring"
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant={danger ? "danger" : "primary"}
            disabled={tooShort || pending}
          >
            {pending ? "Yuborilmoqda…" : confirmLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Panel>
  );
}
