import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/avtoqism/Page";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { useRegister } from "@/lib/query/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [{ title: "Ro'yxatdan o'tish — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: RegisterPage,
});

const PHONE_RE = /^\+?998\d{9}$|^\d{9}$/;

function RegisterPage() {
  const t = useT();
  const navigate = useNavigate();
  const register = useRegister();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2) next["fullName"] = t("checkout.required");
    if (!PHONE_RE.test(phone.replace(/[\s()-]/g, ""))) next["phone"] = t("checkout.phoneInvalid");
    // Mirrors the server rule: 8+ characters, not all letters, not all digits.
    if (password.length < 8 || /^\d+$/.test(password) || /^[a-zA-Z]+$/.test(password)) {
      next["password"] = t("auth.passwordHint");
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const digits = phone.replace(/\D/g, "");
    register.mutate(
      {
        phone: digits.length === 9 ? `+998${digits}` : `+${digits}`,
        password,
        full_name: fullName.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t("auth.register"));
          void navigate({ to: "/garage/add" });
        },
        onError: (error) =>
          setErrors({
            form: error instanceof ApiError ? error.message : t("error.generic"),
          }),
      },
    );
  };

  return (
    <Page className="max-w-md">
      <h1 className="type-h1">{t("auth.register")}</h1>
      <p className="type-caption mt-3">
        Hisob yarating va mashinangizni garajga qo'shing — keyin faqat mos detallarni ko'rasiz.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <Field
          label={t("auth.fullName")}
          value={fullName}
          onChange={setFullName}
          error={errors["fullName"]}
          autoComplete="name"
        />
        <Field
          label={t("auth.phone")}
          value={phone}
          onChange={setPhone}
          error={errors["phone"]}
          autoComplete="tel"
          placeholder="+998 90 123 45 67"
        />
        <Field
          label={t("auth.password")}
          value={password}
          onChange={setPassword}
          error={errors["password"]}
          type="password"
          autoComplete="new-password"
          hint={t("auth.passwordHint")}
        />

        {errors["form"] && (
          <p
            role="alert"
            className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive"
          >
            {errors["form"]}
          </p>
        )}

        <button
          type="submit"
          disabled={register.isPending}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90",
            register.isPending && "opacity-60",
          )}
        >
          {register.isPending && <Loader2 className="size-4 animate-spin" />}
          {t("auth.register")}
        </button>
      </form>

      <p className="type-caption mt-6">
        {t("auth.hasAccount")}{" "}
        <Link to="/login" className="font-semibold text-primary">
          {t("auth.login")}
        </Link>
      </p>
    </Page>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  type?: string | undefined;
  autoComplete?: string | undefined;
  placeholder?: string | undefined;
}) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <label className="block" htmlFor={id}>
      <span className="type-label text-muted-foreground">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={cn(
          "mt-2 h-12 w-full border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary",
          error ? "border-destructive" : "border-input",
        )}
      />
      {error ? (
        <span role="alert" className="mt-1 block text-xs font-semibold text-destructive">
          {error}
        </span>
      ) : hint ? (
        <span className="type-caption mt-1 block">{hint}</span>
      ) : null}
    </label>
  );
}
