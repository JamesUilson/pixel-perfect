/**
 * Sign in.
 *
 * One field for the identity, because the server takes one: `/auth/login`
 * decides on shape whether it was handed a number or an address, and normalises
 * a number the same way registration did. This page shows what that
 * normalisation produced, so somebody who typed `90 123 45 67` can see the
 * account they are signing into is `+998 90 123 45 67`.
 *
 * Signing in succeeds for an unverified account — the server lets those browse.
 * What it will not let them do is check out or open a store, so rather than
 * dropping them on the home page to find that out at the worst moment, an
 * unverified sign-in lands on the verification prompt right here.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/avtoqism/Page";
import { VerificationPrompt } from "@/components/avtoqism/auth/VerificationPrompt";
import { looksLikePhone, normaliseUzPhone, prettyUzPhone } from "@/components/avtoqism/auth/rules";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import type { AccountUser } from "@/lib/query/auth";
import { useLogin } from "@/lib/query/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Kirish — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const login = useLogin();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  /** Signed in, but the contact has not been proved yet. */
  const [unverified, setUnverified] = useState<AccountUser | null>(null);

  // Only meaningful when what was typed reads as a number at all; an e-mail
  // must not be told it is a malformed phone.
  const canonical = useMemo(() => {
    const raw = identifier.trim();
    if (raw === "" || !looksLikePhone(raw)) return null;
    return normaliseUzPhone(raw);
  }, [identifier]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!identifier.trim() || !password) {
      setFormError(t("checkout.required"));
      return;
    }
    login.mutate(
      { identifier: identifier.trim(), password },
      {
        onSuccess: (result) => {
          setPassword("");
          if (result.user.is_verified === false) {
            setUnverified(result.user);
            return;
          }
          toast.success(t("auth.login"));
          void navigate({ to: "/" });
        },
        onError: (error) =>
          setFormError(error instanceof ApiError ? error.message : t("error.generic")),
      },
    );
  };

  if (unverified) {
    return (
      <Page className="max-w-md">
        <h1 className="type-h1">Tasdiqlash kerak</h1>
        <p className="type-caption mt-3">
          Hisobingizga kirdingiz. Aloqa raqamini tasdiqlasangiz, hamma narsa ochiladi.
        </p>

        <div className="mt-8">
          <VerificationPrompt
            user={unverified}
            onVerified={() => {
              toast.success("Hisobingiz tasdiqlandi.");
              void navigate({ to: "/" });
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => void navigate({ to: "/" })}
          className="type-caption mt-6 underline underline-offset-4"
        >
          Keyinroq — hozircha katalogni ko'raman
        </button>
      </Page>
    );
  }

  return (
    <Page className="max-w-md">
      <h1 className="type-h1">{t("auth.login")}</h1>
      <p className="type-caption mt-3">AVTOQISM hisobingizga kiring.</p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <label className="block" htmlFor="login-identifier">
          <span className="type-label text-muted-foreground">{t("auth.identifier")}</span>
          <input
            id="login-identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            placeholder="+998 90 123 45 67"
            className="mt-2 h-12 w-full border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
          />
          {canonical && (
            <span className="type-caption mt-1 block">
              Hisob: <span className="font-semibold">{prettyUzPhone(canonical)}</span>
            </span>
          )}
        </label>

        <label className="block" htmlFor="login-password">
          <span className="type-label text-muted-foreground">{t("auth.password")}</span>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-2 h-12 w-full border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
          />
        </label>

        {formError && (
          <p
            role="alert"
            className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive"
          >
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90",
            login.isPending && "opacity-60",
          )}
        >
          {login.isPending && <Loader2 className="size-4 animate-spin" />}
          {t("auth.login")}
        </button>
      </form>

      <p className="type-caption mt-6">
        {t("auth.noAccount")}{" "}
        <Link to="/register" className="font-semibold text-primary">
          {t("auth.register")}
        </Link>
      </p>
    </Page>
  );
}
