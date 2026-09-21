/**
 * The six digits that turn an account into a verified one.
 *
 * Three states have to be visible, because all three actually happen and a form
 * that hides them leaves the person tapping a button that will never work:
 *
 *   - **the cooldown.** `/auth/register/resend` refuses inside
 *     `OTP_RESEND_COOLDOWN_SECONDS` and says how long is left in
 *     `details.retry_after_seconds`. The countdown starts from whatever the
 *     server last told us, never from a number invented here.
 *   - **the attempts.** The server counts them and commits the count before it
 *     answers, so the limit is real. It does not send the count back, so what
 *     is shown is this browser's own tally — described as such — while the
 *     authority stays `otp_attempts_exhausted`.
 *   - **the lock.** Once that code arrives, entering digits is pointless: the
 *     input goes away and the only move left is a new code.
 *
 * The development code is rendered only when the response carries one, which
 * only ever happens where the SMS provider writes to a log instead of to a
 * phone, and it is labelled as a development aid rather than dressed up as
 * something the buyer received.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { VerificationResult } from "@/lib/query/auth";
import { useRegisterResend, useRegisterVerify } from "@/lib/query/auth";
import { cn } from "@/lib/utils";
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  looksLikePhone,
  prettyUzPhone,
  retryAfterSeconds,
} from "./rules";

const CODE_LENGTH = 6;

export function VerificationCodeForm({
  identifier,
  initialDevCode = null,
  initialResendAfter = OTP_RESEND_COOLDOWN_SECONDS,
  onVerified,
  onChangeIdentifier,
}: {
  /** The phone or e-mail the code went to, in the form the server normalised. */
  identifier: string;
  initialDevCode?: string | null | undefined;
  initialResendAfter?: number | undefined;
  onVerified: (result: VerificationResult) => void;
  /** Rendered as a "wrong number?" escape when the caller can offer one. */
  onChangeIdentifier?: (() => void) | undefined;
}) {
  const verify = useRegisterVerify();
  const resend = useRegisterResend();

  const [code, setCode] = useState("");
  const [failedHere, setFailedHere] = useState(0);
  const [locked, setLocked] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(initialDevCode);
  const [cooldown, setCooldown] = useState(initialResendAfter);
  const inputRef = useRef<HTMLInputElement>(null);

  // One ticker for the whole component. Started in an effect, so the first
  // server-rendered paint and the first client paint agree.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((left) => (left <= 1 ? 0 : left - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const shown = useMemo(
    () => (looksLikePhone(identifier) ? prettyUzPhone(identifier) : identifier),
    [identifier],
  );

  const ready = code.length === CODE_LENGTH && !locked;
  const remaining = Math.max(OTP_MAX_ATTEMPTS - failedHere, 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || verify.isPending) return;
    verify.mutate(
      { identifier, code },
      {
        onSuccess: onVerified,
        onError: (error) => {
          setCode("");
          inputRef.current?.focus();
          if (error instanceof ApiError && error.code === "otp_attempts_exhausted") {
            setLocked(true);
            return;
          }
          setFailedHere((count) => count + 1);
        },
      },
    );
  }

  function askAgain() {
    if (resend.isPending || cooldown > 0) return;
    resend.mutate(identifier, {
      onSuccess: (result) => {
        // A new code resets the server's counter, so this one resets too.
        setLocked(false);
        setFailedHere(0);
        setCode("");
        setDevCode(null);
        setCooldown(result.resend_after);
        inputRef.current?.focus();
      },
      onError: (error) => {
        if (!(error instanceof ApiError)) return;
        const wait = retryAfterSeconds(error.code, error.details);
        if (wait !== null) setCooldown(wait);
      },
    });
  }

  const verifyError =
    verify.isError &&
    verify.error instanceof ApiError &&
    verify.error.code !== "otp_attempts_exhausted"
      ? verify.error.message
      : null;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="type-caption">
        Tasdiqlash kodi <span className="font-semibold text-foreground">{shown}</span> manziliga
        yuborildi. Olti xonali kodni kiriting.
      </p>

      {locked ? (
        <div
          role="alert"
          className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-semibold">Urinishlar soni tugadi.</p>
          <p className="mt-1">
            Bu kod endi ishlamaydi. Yangi kod so'rang — urinishlar hisobi noldan boshlanadi.
          </p>
        </div>
      ) : (
        <label className="block">
          <span className="type-label text-muted-foreground">Tasdiqlash kodi</span>
          <input
            ref={inputRef}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Olti xonali tasdiqlash kodi"
            aria-invalid={Boolean(verifyError)}
            placeholder="000000"
            maxLength={CODE_LENGTH}
            className={cn(
              "mt-2 h-14 w-full border bg-surface px-3 text-center font-mono text-xl tracking-[0.5em] outline-none transition-colors focus:border-primary",
              verifyError ? "border-destructive" : "border-input",
            )}
          />
          {failedHere > 0 && (
            <span className="type-caption mt-1 block">
              Bu qurilmada {failedHere} ta noto'g'ri urinish. Jami {OTP_MAX_ATTEMPTS} tadan keyin
              kod bloklanadi — {remaining} ta qoldi.
            </span>
          )}
        </label>
      )}

      {devCode !== null && devCode !== "" && (
        <p className="border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          <span className="type-label block">Ishlab chiqish rejimi</span>
          Kod: <span className="font-mono font-bold">{devCode}</span> — haqiqiy SMS yuborilmadi.
        </p>
      )}

      {verifyError && (
        <p
          role="alert"
          className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive"
        >
          {verifyError}
        </p>
      )}
      {resend.isError && resend.error instanceof ApiError && (
        <p role="alert" className="text-sm text-destructive">
          {resend.error.message}
        </p>
      )}

      {!locked && (
        <button
          type="submit"
          disabled={!ready || verify.isPending}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90",
            (!ready || verify.isPending) && "opacity-60",
          )}
        >
          {verify.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ShieldCheck className="size-4" aria-hidden />
          )}
          Tasdiqlash
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={askAgain}
          disabled={cooldown > 0 || resend.isPending}
          className="text-sm font-semibold text-primary disabled:text-muted-foreground"
        >
          {resend.isPending
            ? "Yuborilmoqda…"
            : cooldown > 0
              ? `Qayta yuborish — ${cooldown} soniyadan so'ng`
              : "Kodni qayta yuborish"}
        </button>
        {onChangeIdentifier && (
          <button
            type="button"
            onClick={onChangeIdentifier}
            className="type-caption underline underline-offset-4"
          >
            Boshqa raqam kiritish
          </button>
        )}
      </div>
    </form>
  );
}
