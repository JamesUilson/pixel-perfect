/**
 * "Your account is not verified yet, and here is what that costs you."
 *
 * The rule itself lives in one place on the server — `app/core/verification.py`
 * lists exactly two actions an unverified account may not take — so this
 * component lists exactly those two and nothing else. Saying "some features are
 * limited" would be both vaguer and, the day the list changes, wrong.
 *
 * It is a component rather than a block inside one screen because the same
 * prompt belongs in at least three places: straight after registration, on the
 * sign-in page when someone signs in to an unverified account, and in the
 * account area of the profile page.
 */
import { useState } from "react";
import { AlertTriangle, ShoppingBag, Store } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { AccountUser, VerificationResult } from "@/lib/query/auth";
import { useRegisterResend, verificationIdentifier } from "@/lib/query/auth";
import { OTP_RESEND_COOLDOWN_SECONDS, retryAfterSeconds } from "./rules";
import { VerificationCodeForm } from "./VerificationCodeForm";

/** The whole of `VERIFIED_ONLY_ACTIONS`, in the words a buyer uses. */
export const UNVERIFIED_LIMITS = [
  {
    icon: ShoppingBag,
    title: "Buyurtma berib bo'lmaydi",
    detail: "To'lov sahifasi tasdiqlanmagan hisobdan buyurtmani qabul qilmaydi.",
  },
  {
    icon: Store,
    title: "Do'kon ochib bo'lmaydi",
    detail: "Sotuvchi bo'lish uchun aloqa raqami tasdiqlangan bo'lishi shart.",
  },
] as const;

/** The same two lines, on their own — for a screen that only needs the warning. */
export function UnverifiedLimits({ className }: { className?: string | undefined }) {
  return (
    <ul className={className}>
      {UNVERIFIED_LIMITS.map((limit) => {
        const Icon = limit.icon;
        return (
          <li key={limit.title} className="flex gap-3 py-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-sm">
              <span className="font-semibold">{limit.title}.</span>{" "}
              <span className="text-muted-foreground">{limit.detail}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function VerificationPrompt({
  user,
  onVerified,
  className,
}: {
  user: AccountUser | undefined;
  onVerified?: ((result: VerificationResult) => void) | undefined;
  className?: string | undefined;
}) {
  const resend = useRegisterResend();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(OTP_RESEND_COOLDOWN_SECONDS);

  const identifier = verificationIdentifier(user);
  // A verified account, or one with no contact left to verify, needs no prompt.
  if (user === undefined || user.is_verified !== false || identifier === null) return null;

  function start() {
    if (identifier === null || resend.isPending) return;
    resend.mutate(identifier, {
      onSuccess: (result) => {
        setCooldown(result.resend_after);
        setSentTo(identifier);
      },
      onError: (error) => {
        if (!(error instanceof ApiError)) return;
        const wait = retryAfterSeconds(error.code, error.details);
        // Inside the cooldown a code is already on its way — show the form
        // rather than the refusal, or the person waits for something they have.
        if (wait !== null) {
          setCooldown(wait);
          setSentTo(identifier);
        }
      },
    });
  }

  return (
    <section
      className={className ?? "border border-warning/40 bg-warning/10 p-5"}
      aria-labelledby="verify-prompt-title"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 id="verify-prompt-title" className="type-h3">
            Hisobingiz tasdiqlanmagan
          </h3>
          <p className="type-caption mt-1">
            Katalogni ko'rish, savatga qo'shish va garajni to'ldirish ochiq. Tasdiqlanmaguncha esa:
          </p>
          <UnverifiedLimits className="mt-3" />

          {sentTo === null ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={start}
                disabled={resend.isPending}
                className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {resend.isPending ? "Yuborilmoqda…" : "Tasdiqlash kodini yuborish"}
              </button>
              {resend.isError && resend.error instanceof ApiError && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {resend.error.message}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 border border-border bg-card p-4">
              <VerificationCodeForm
                identifier={sentTo}
                initialResendAfter={cooldown}
                onVerified={(result) => onVerified?.(result)}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
