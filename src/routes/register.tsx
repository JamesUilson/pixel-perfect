/**
 * Registration, in two steps, because that is what the API does now.
 *
 * `POST /auth/register/start` creates the account and sends a code;
 * `POST /auth/register/verify` accepts the code and signs the person in. The
 * first call answers identically whether or not the contact was already taken —
 * that is deliberate on the server's side, so nothing on this screen may claim
 * otherwise. "Kod yuborildi" is the only honest thing to say, and it is what is
 * said for everybody.
 *
 * The form runs the server's own password rules as the person types
 * (`components/avtoqism/auth/rules.ts` mirrors `validators.py`), so nobody is
 * bounced by the API for something this page could have told them. The server
 * stays the authority: when it refuses, its message is what appears, and when
 * it names several problems at once, all of them do.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/avtoqism/Page";
import { UnverifiedLimits } from "@/components/avtoqism/auth/VerificationPrompt";
import { VerificationCodeForm } from "@/components/avtoqism/auth/VerificationCodeForm";
import {
  PASSWORD_MIN_LENGTH,
  UZ_REGIONS,
  looksLikeEmail,
  normaliseUzPhone,
  passwordProblems,
  passwordStrength,
  prettyUzPhone,
  serverPasswordProblems,
} from "@/components/avtoqism/auth/rules";
import { ApiError } from "@/lib/api/client";
import { useLang, useT } from "@/lib/i18n";
import { useRegisterStart } from "@/lib/query/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [{ title: "Ro'yxatdan o'tish — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: RegisterPage,
});

type Channel = "phone" | "email";

function RegisterPage() {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const start = useRegisterStart();

  const [channel, setChannel] = useState<Channel>("phone");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [touched, setTouched] = useState(false);

  /** Set once the code is on its way; the form is replaced by the code step. */
  const [pendingIdentifier, setPendingIdentifier] = useState<string | null>(null);
  const [resendAfter, setResendAfter] = useState(60);

  const canonicalPhone = useMemo(() => normaliseUzPhone(phone), [phone]);
  const trimmedEmail = email.trim().toLowerCase();
  const emailOk = looksLikeEmail(trimmedEmail);

  const problems = useMemo(
    () =>
      passwordProblems(password, {
        phone: channel === "phone" ? canonicalPhone : null,
        email: channel === "email" ? trimmedEmail : null,
        fullName,
      }),
    [password, channel, canonicalPhone, trimmedEmail, fullName],
  );
  const strength = passwordStrength(password, problems);

  /** Everything the server would refuse, checked here first. */
  const fieldErrors: Record<string, string | undefined> = {
    fullName: touched && fullName.trim().length < 2 ? "Ism va familiyani kiriting." : undefined,
    phone:
      touched && channel === "phone" && canonicalPhone === null
        ? "Telefon raqami noto'g'ri. Masalan: +998 90 123 45 67"
        : undefined,
    email: touched && channel === "email" && !emailOk ? "E-pochta manzili noto'g'ri." : undefined,
    region: touched && region === "" ? "Viloyatni tanlang." : undefined,
    password: touched && problems.length > 0 ? problems[0] : undefined,
    terms: touched && !acceptTerms ? "Davom etish uchun shartlarni qabul qiling." : undefined,
  };

  const identityOk = channel === "phone" ? canonicalPhone !== null : emailOk;
  const valid =
    fullName.trim().length >= 2 &&
    identityOk &&
    region !== "" &&
    problems.length === 0 &&
    acceptTerms;

  const serverError = start.error instanceof ApiError ? start.error : null;
  const serverProblems = serverError ? serverPasswordProblems(serverError.details) : [];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!valid || start.isPending) return;

    const identifier = channel === "phone" ? (canonicalPhone as string) : trimmedEmail;
    start.mutate(
      {
        // Only the chosen channel is sent. The server keeps whichever it is
        // given as the primary contact, and the code goes there.
        ...(channel === "phone" ? { phone: canonicalPhone as string } : { email: trimmedEmail }),
        password,
        full_name: fullName.trim(),
        region,
        ...(city.trim() === "" ? {} : { city: city.trim() }),
        // The language they are reading this form in. `RegisterIn.locale`
        // defaults to "uz" server-side, so leaving it out meant every Russian
        // speaker's account — and every message sent to it — was in Uzbek.
        locale: lang,
        accept_terms: acceptTerms,
      },
      {
        onSuccess: (result) => {
          setResendAfter(result.resend_after);
          setPendingIdentifier(identifier);
          // The password is not needed again and has no business lingering.
          setPassword("");
        },
      },
    );
  }

  if (pendingIdentifier !== null) {
    return (
      <Page className="max-w-md">
        <h1 className="type-h1">Tasdiqlash</h1>
        <p className="type-caption mt-3">
          Ro'yxatdan o'tishni yakunlash uchun kodni kiriting. Kod kelmasa — raqamni tekshiring va
          qayta so'rang.
        </p>

        <div className="mt-8">
          <VerificationCodeForm
            identifier={pendingIdentifier}
            initialResendAfter={resendAfter}
            onVerified={() => {
              toast.success("Hisobingiz tasdiqlandi.");
              void navigate({ to: "/garage/add" });
            }}
            onChangeIdentifier={() => {
              setPendingIdentifier(null);
              start.reset();
            }}
          />
        </div>

        <div className="mt-8 border border-border bg-card p-4">
          <p className="type-label text-muted-foreground">Tasdiqlanmagan hisob nima qila olmaydi</p>
          <UnverifiedLimits className="mt-2" />
        </div>

        {/*
         * `/auth/register/start` has already created the account by the time
         * this step is on screen, and an unverified account may sign in and
         * browse. Without saying so, somebody whose SMS never arrives is stuck
         * on a code box with no way forward and no idea they have an account at
         * all — and the next thing they do is register again with another
         * number.
         */}
        <div className="mt-4 border border-border bg-muted/40 p-4">
          <p className="text-sm font-semibold">Kod kelmadi va kuta olmayapsizmi?</p>
          <p className="type-caption mt-1">
            Hisobingiz allaqachon yaratilgan. Kirib katalogni ko'rishingiz mumkin, tasdiqlashni esa
            keyinroq profil sahifasidan yakunlaysiz — qaytadan ro'yxatdan o'tish kerak emas.
          </p>
          <Link
            to="/login"
            className="mt-3 inline-flex border border-border-strong bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            {t("auth.login")}
          </Link>
        </div>
      </Page>
    );
  }

  return (
    <Page className="max-w-md">
      <h1 className="type-h1">{t("auth.register")}</h1>
      <p className="type-caption mt-3">
        Hisob yarating va mashinangizni garajga qo'shing — keyin faqat mos detallarni ko'rasiz.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <ChannelPicker value={channel} onChange={setChannel} />

        <Field
          label={t("auth.fullName")}
          value={fullName}
          onChange={setFullName}
          error={fieldErrors["fullName"]}
          autoComplete="name"
          placeholder="Alisher Karimov"
        />

        {channel === "phone" ? (
          <Field
            label={t("auth.phone")}
            value={phone}
            onChange={setPhone}
            error={fieldErrors["phone"]}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+998 90 123 45 67"
            hint={
              canonicalPhone
                ? `Saqlanadigan ko'rinish: ${prettyUzPhone(canonicalPhone)}`
                : "Istalgan ko'rinishda yozing: 90 123 45 67, 998901234567, +998901234567."
            }
          />
        ) : (
          <Field
            label="E-pochta"
            value={email}
            onChange={setEmail}
            error={fieldErrors["email"]}
            autoComplete="email"
            inputMode="email"
            type="email"
            placeholder="ism@example.uz"
          />
        )}

        <label className="block">
          <span className="type-label text-muted-foreground">Viloyat</span>
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            aria-invalid={Boolean(fieldErrors["region"])}
            className={cn(
              "mt-2 h-12 w-full appearance-none border bg-surface px-3 text-sm outline-none transition-colors focus:border-primary",
              fieldErrors["region"] ? "border-destructive" : "border-input",
            )}
          >
            <option value="">Tanlang</option>
            {UZ_REGIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {fieldErrors["region"] && (
            <span role="alert" className="mt-1 block text-xs font-semibold text-destructive">
              {fieldErrors["region"]}
            </span>
          )}
        </label>

        <Field
          label="Shahar yoki tuman"
          value={city}
          onChange={setCity}
          autoComplete="address-level2"
          placeholder="Chilonzor"
          hint={t("common.optional")}
        />

        <div>
          <Field
            label={t("auth.password")}
            value={password}
            onChange={setPassword}
            type="password"
            autoComplete="new-password"
          />
          <PasswordFeedback password={password} problems={problems} strength={strength} />
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(event) => setAcceptTerms(event.target.checked)}
            aria-invalid={Boolean(fieldErrors["terms"])}
            className="mt-0.5 size-4 shrink-0 border border-input accent-primary"
          />
          <span>
            AVTOQISM <span className="font-semibold">foydalanish shartlari</span> va{" "}
            <span className="font-semibold">maxfiylik siyosati</span>ga roziman.
          </span>
        </label>
        {fieldErrors["terms"] && (
          <p role="alert" className="text-xs font-semibold text-destructive">
            {fieldErrors["terms"]}
          </p>
        )}

        {serverError && (
          <div
            role="alert"
            className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <p className="font-semibold">{serverError.message}</p>
            {serverProblems.length > 1 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {serverProblems.slice(1).map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={start.isPending}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90",
            start.isPending && "opacity-60",
          )}
        >
          {start.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Kod yuborish
        </button>
      </form>

      <p className="type-caption mt-6">
        {t("auth.hasAccount")}{" "}
        <Link to="/login" className="font-semibold text-primary">
          {t("auth.login")}
        </Link>
      </p>

      {/* One account, two uses: a seller registers here and opens the store
          afterwards. Saying so is the only way somebody who came to sell finds
          the door, and it sets the expectation about approval up front. */}
      <div className="mt-8 border-t border-border pt-6">
        <p className="text-sm font-semibold">Sotmoqchimisiz?</p>
        <p className="type-caption mt-1">
          Shu hisob bilan do'kon ochasiz. Do'kon administrator tasdig'idan keyin katalogda ko'rinadi
          — ro'yxatdan o'tish bepul, komissiya faqat sotuvdan olinadi.
        </p>
        <Link
          to="/seller/onboard"
          className="type-caption mt-2 inline-block font-semibold text-primary underline underline-offset-4"
        >
          Sotuvchi bo'lish haqida
        </Link>
      </div>
    </Page>
  );
}

/* --- pieces ------------------------------------------------------------------- */
function ChannelPicker({
  value,
  onChange,
}: {
  value: Channel;
  onChange: (value: Channel) => void;
}) {
  const options: { key: Channel; label: string }[] = [
    { key: "phone", label: "Telefon raqami" },
    { key: "email", label: "E-pochta" },
  ];
  return (
    <div className="flex border border-border" role="group" aria-label="Ro'yxatdan o'tish usuli">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            "flex-1 px-4 py-3 text-sm font-semibold transition-colors",
            value === option.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The password rules, live.
 *
 * The list is the server's own `password_problems` output, so a requirement
 * that disappears from it disappears from here too — there is no second,
 * hand-written list to drift out of step.
 */
function PasswordFeedback({
  password,
  problems,
  strength,
}: {
  password: string;
  problems: string[];
  strength: 0 | 1 | 2 | 3;
}) {
  if (password === "") {
    return (
      <p className="type-caption mt-2">
        Kamida {PASSWORD_MIN_LENGTH} ta belgi, faqat raqamlardan yoki faqat harflardan iborat
        bo'lmasin.
      </p>
    );
  }

  const tone = strength >= 3 ? "bg-success" : strength === 2 ? "bg-success" : "bg-destructive";
  const label = strength >= 3 ? "Kuchli" : strength === 2 ? "Yetarli" : "Zaif";

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex h-1 flex-1 gap-1" aria-hidden>
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={cn("h-full flex-1", step <= strength ? tone : "bg-border")}
            />
          ))}
        </div>
        <span className="type-label text-muted-foreground">{label}</span>
      </div>

      {problems.length === 0 ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-success">
          <Check className="size-3.5" aria-hidden />
          Parol talablarga javob beradi.
        </p>
      ) : (
        <ul className="space-y-1">
          {problems.map((problem) => (
            <li key={problem} className="flex items-start gap-2 text-xs text-destructive">
              <X className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {problem}
            </li>
          ))}
        </ul>
      )}
    </div>
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
  inputMode,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  type?: string | undefined;
  autoComplete?: string | undefined;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] | undefined;
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
        inputMode={inputMode}
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
