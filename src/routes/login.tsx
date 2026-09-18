import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/avtoqism/Page";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
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
        onSuccess: () => {
          toast.success(t("auth.login"));
          void navigate({ to: "/" });
        },
        onError: (error) =>
          setFormError(error instanceof ApiError ? error.message : t("error.generic")),
      },
    );
  };

  return (
    <Page className="max-w-md">
      <h1 className="type-h1">{t("auth.login")}</h1>
      <p className="type-caption mt-3">AVTOQISM hisobingizga kiring.</p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <label className="block">
          <span className="type-label text-muted-foreground">{t("auth.identifier")}</span>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            placeholder="+998 90 123 45 67"
            className="mt-2 h-12 w-full border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="type-label text-muted-foreground">{t("auth.password")}</span>
          <input
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
