import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/avtoqism/Page";
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  looksLikeEmail,
  looksLikePhone,
  normaliseUzPhone,
  passwordProblems,
  passwordStrength,
  prettyUzPhone,
  serverPasswordProblems,
} from "@/components/avtoqism/auth/rules";
import { ApiError } from "@/lib/api/client";
import { useForgotPassword, useResetPassword } from "@/lib/query/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/password")({
  head: () => ({
    meta: [{ title: "Parolni tiklash — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: ForgotPassword,
});

const FIELD =
  "mt-2 h-12 w-full border border-input bg-surface px-3 text-sm outline-none focus:border-primary";

/**
 * "I forgot my password", in two steps.
 *
 * Both endpoints have existed since the beginning and nothing ever called
 * them. Login locks an account after repeated failures, so a buyer who
 * mistyped their password a few times had no route back to their own orders.
 *
 * The first step answers the same whether or not the account exists, and this
 * screen says so out loud — otherwise someone who typed a wrong number waits
 * for an SMS that was never going to arrive, and concludes the site is broken.
 */
function ForgotPassword() {
  const navigate = useNavigate();
  const forgot = useForgotPassword();
  const reset = useResetPassword();

  const [step, setStep] = useState<"ask" | "enter">("ask");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const canonical = looksLikePhone(identifier) ? normaliseUzPhone(identifier) : null;
  const plausible = canonical !== null || looksLikeEmail(identifier);

  const localProblems = passwordProblems(password, { phone: canonical });
  const strength = passwordStrength(password, localProblems);

  function startCooldown() {
    setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
    const timer = setInterval(() => {
      setCooldown((seconds) => {
        if (seconds <= 1) {
          clearInterval(timer);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
  }

  function ask(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    forgot.mutate(
      { identifier: canonical ?? identifier.trim() },
      {
        onSuccess: (result) => {
          setDevCode(result.debug_code ?? null);
          setStep("enter");
          setAttempts(0);
          setLocked(false);
          startCooldown();
        },
        onError: (err) => setError(err instanceof Error ? err.message : "Kod yuborib bo'lmadi."),
      },
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setProblems([]);

    // The server is the authority, but bouncing off it for something the form
    // already knows is a wasted round trip and a worse explanation.
    if (localProblems.length > 0) {
      setProblems(localProblems);
      return;
    }

    reset.mutate(
      { identifier: canonical ?? identifier.trim(), code: code.trim(), new_password: password },
      {
        onSuccess: () => {
          toast.success("Parol yangilandi. Endi kiring.");
          void navigate({ to: "/login" });
        },
        onError: (err) => {
          const code_ = err instanceof ApiError ? err.code : null;
          if (code_ === "weak_password") {
            setProblems(
              serverPasswordProblems(
                err instanceof ApiError
                  ? (err.details as Record<string, unknown> | undefined)
                  : undefined,
              ),
            );
            return;
          }
          if (code_ === "otp_attempts_exhausted") {
            setLocked(true);
            setError("Urinishlar soni tugadi. Yangi kod so'rang.");
            return;
          }
          if (code_ === "otp_invalid") setAttempts((n) => n + 1);
          setError(err instanceof Error ? err.message : "Kod noto'g'ri.");
        },
      },
    );
  }

  return (
    <Page className="max-w-md">
      <h1 className="type-h1">Parolni tiklash</h1>

      {step === "ask" ? (
        <>
          <p className="type-caption mt-3">
            Telefon raqamingiz yoki e-pochtangizni kiriting — tasdiqlash kodi yuboriladi.
          </p>

          <form onSubmit={ask} className="mt-8 space-y-4" noValidate>
            <label className="block" htmlFor="forgot-identifier">
              <span className="type-label text-muted-foreground">Telefon yoki e-pochta</span>
              <input
                id="forgot-identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                placeholder="+998 90 123 45 67"
                className={FIELD}
              />
              {canonical && (
                <span className="type-caption mt-1 block">
                  Hisob: <span className="font-semibold">{prettyUzPhone(canonical)}</span>
                </span>
              )}
            </label>

            {error && <Alert>{error}</Alert>}

            <button
              type="submit"
              disabled={!plausible || forgot.isPending}
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90",
                (!plausible || forgot.isPending) && "opacity-60",
              )}
            >
              {forgot.isPending && <Loader2 className="size-4 animate-spin" />}
              Kod yuborish
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="type-caption mt-3">
            Kod{" "}
            <span className="font-semibold text-foreground">
              {canonical ? prettyUzPhone(canonical) : identifier}
            </span>{" "}
            manziliga yuborildi.
          </p>
          {/* Said plainly, because the endpoint deliberately answers the same
              for a number nobody has registered — and somebody who mistyped
              theirs would otherwise sit waiting for an SMS forever. */}
          <p className="type-caption mt-1">
            Agar bu manzilda hisob bo'lmasa, kod kelmaydi. Raqamni tekshiring.
          </p>

          {devCode && (
            <p className="mt-4 border border-border bg-muted/50 px-4 py-3 text-sm">
              <span className="type-label block text-muted-foreground">Ishlab chiqish rejimi</span>
              Kod: <span className="font-bold tracking-widest">{devCode}</span>
            </p>
          )}

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <label className="block" htmlFor="forgot-code">
              <span className="type-label text-muted-foreground">Tasdiqlash kodi</span>
              <input
                id="forgot-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className={cn(FIELD, "tracking-[0.4em]")}
              />
              {attempts > 0 && !locked && (
                <span className="type-caption mt-1 block text-destructive">
                  Noto'g'ri urinish: {attempts} / {OTP_MAX_ATTEMPTS}
                </span>
              )}
            </label>

            <label className="block" htmlFor="forgot-password">
              <span className="type-label text-muted-foreground">Yangi parol</span>
              <input
                id="forgot-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={FIELD}
              />
              {password.length > 0 && (
                <span className="mt-2 flex gap-1" aria-hidden>
                  {[0, 1, 2].map((bar) => (
                    <span
                      key={bar}
                      className={cn(
                        "h-1 flex-1 transition-colors",
                        strength > bar ? "bg-primary" : "bg-border",
                      )}
                    />
                  ))}
                </span>
              )}
              {password.length > 0 && localProblems.length === 0 && (
                <span className="type-caption mt-1 flex items-center gap-1 text-foreground">
                  <Check className="size-3.5 text-primary" aria-hidden />
                  Parol yetarli
                </span>
              )}
            </label>

            {problems.length > 0 && (
              <ul className="space-y-1 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}

            {error && <Alert>{error}</Alert>}

            <button
              type="submit"
              disabled={code.length < 4 || password.length === 0 || reset.isPending || locked}
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90",
                (code.length < 4 || password.length === 0 || reset.isPending || locked) &&
                  "opacity-60",
              )}
            >
              {reset.isPending && <Loader2 className="size-4 animate-spin" />}
              Parolni yangilash
            </button>

            <button
              type="button"
              onClick={() => ask()}
              disabled={cooldown > 0 || forgot.isPending}
              className="type-caption w-full underline underline-offset-4 disabled:no-underline disabled:opacity-60"
            >
              {cooldown > 0 ? `Qayta yuborish — ${cooldown}s` : "Kodni qayta yuborish"}
            </button>
          </form>
        </>
      )}

      <p className="type-caption mt-8">
        Parolingiz esingizdami?{" "}
        <Link to="/login" className="font-semibold underline underline-offset-4">
          Kirish
        </Link>
      </p>
    </Page>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive"
    >
      {children}
    </p>
  );
}
