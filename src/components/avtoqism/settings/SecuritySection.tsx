/**
 * The password, the verified contacts, and what the server knows about both.
 *
 * Three things live in one card because they answer one question — "is this
 * account still mine?" — and somebody who came here worried should not have to
 * find the answer in three places.
 *
 * The password form runs the server's own rules as the person types, from the
 * same `auth/rules.ts` the register screen uses. That is deliberate reuse rather
 * than a second implementation: a requirement that changes in `validators.py`
 * changes in one file here, and both screens follow.
 *
 * Changing a phone or an e-mail goes through the same two steps as registration
 * — ask, then prove — and the old contact keeps working until the new one is
 * proved, so a typo cannot lock anybody out of their own account.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Mail, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";

import {
  ActionButton,
  ErrorNote,
  FieldInput,
  SettingRow,
  SettingsCard,
  SuccessNote,
} from "./Primitives";
import {
  looksLikeEmail,
  normaliseUzPhone,
  passwordProblems,
  passwordStrength,
  prettyUzPhone,
  serverPasswordProblems,
} from "@/components/avtoqism/auth/rules";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import type { AccountUser } from "@/lib/query/auth";
import {
  useChangePassword,
  useSecuritySummary,
  useStartContactChange,
  useVerifyContactChange,
  type ContactChannelKey,
} from "@/lib/query/settings";
import { cn } from "@/lib/utils";

export const SECURITY_ID = "xavfsizlik";

export function SecuritySection({ user }: { user: AccountUser | undefined }) {
  const t = useT();
  const { lang } = useLang();
  const summary = useSecuritySummary();

  // The summary is a convenience, not the truth: `/auth/me` already carries the
  // contacts and their verified flags, so the card is complete even when this
  // endpoint is unavailable.
  const data = summary.data;
  const phone = data?.phone ?? user?.phone ?? null;
  const email = data?.email ?? user?.email ?? null;
  const phoneVerified = data?.phone_verified ?? user?.phone_verified ?? false;
  const emailVerified = data?.email_verified ?? user?.email_verified ?? false;
  const changedAt = data?.password_changed_at ?? null;
  const pending = data?.pending_contacts ?? [];

  return (
    <SettingsCard
      id={SECURITY_ID}
      icon={ShieldCheck}
      title={t("settings.security")}
      subtitle={t("settings.securitySub")}
    >
      <PasswordRow changedAt={changedAt} user={user} />

      <ContactRow
        channel="PHONE"
        icon={Smartphone}
        label={t("settings.phone")}
        value={phone}
        display={phone ? prettyUzPhone(phone) : null}
        verified={phoneVerified}
      />
      <ContactRow
        channel="EMAIL"
        icon={Mail}
        label={t("settings.email")}
        value={email}
        display={email}
        verified={emailVerified}
      />

      {/* A half-finished change, so it is visible rather than mysterious: the
          server keeps it pending until the code arrives, and somebody who typed
          a number yesterday and closed the tab should see it here. */}
      {pending.length > 0 && (
        <div className="px-5 py-4 lg:px-6">
          <p className="type-label text-warning-foreground">{t("settings.pendingContact")}</p>
          <ul className="mt-2 space-y-1">
            {pending.map((item) => (
              <li key={`${item.channel}-${item.value}`} className="text-sm">
                <span className="font-semibold">
                  {item.channel === "PHONE" ? prettyUzPhone(item.value) : item.value}
                </span>{" "}
                <span className="type-caption">· {formatDateTime(item.requested_at, lang)}</span>
              </li>
            ))}
          </ul>
          <p className="type-caption mt-2">{t("settings.pendingContactSub")}</p>
        </div>
      )}

      {/* The one figure the summary adds that is not already on this card. Read
          rather than acted on, so it goes last. */}
      {typeof data?.active_sessions === "number" && (
        <div className="px-5 py-4 lg:px-6">
          <dl>
            <dt className="type-label text-muted-foreground">{t("settings.activeSessions")}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums">{data.active_sessions}</dd>
          </dl>
        </div>
      )}
    </SettingsCard>
  );
}

/* --- the password ---------------------------------------------------------- */
/**
 * Changing the password signs every device out, this one included.
 *
 * That is the server's behaviour and it is the right one, so the form says so
 * before the change and lands on the sign-in page after it. There is no success
 * state to render in place: the session is gone by then and this whole card has
 * unmounted with it.
 */
function PasswordRow({
  changedAt,
  user,
}: {
  changedAt: string | null;
  /** For the password rules: the server refuses a password containing either. */
  user: AccountUser | undefined;
}) {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const change = useChangePassword();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [touched, setTouched] = useState(false);

  /*
   * The same context `assert_password_ok` is given server-side. Without it the
   * form passed a password containing the person's own name and the API bounced
   * it — which is the exact failure `rules.ts` exists to prevent.
   */
  const problems = useMemo(
    () =>
      passwordProblems(next, {
        phone: user?.phone ?? null,
        email: user?.email ?? null,
        fullName: user?.full_name ?? null,
      }),
    [next, user?.phone, user?.email, user?.full_name],
  );
  const strength = passwordStrength(next, problems);
  const mismatch = repeat !== "" && repeat !== next;
  const same = next !== "" && next === current;

  const serverError = change.error instanceof ApiError ? change.error : null;
  const serverProblems = serverError ? serverPasswordProblems(serverError.details) : [];

  const valid = current !== "" && next !== "" && problems.length === 0 && repeat === next && !same;

  function close() {
    setOpen(false);
    setCurrent("");
    setNext("");
    setRepeat("");
    setTouched(false);
    change.reset();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!valid || change.isPending) return;
    change.mutate(
      { current_password: current, new_password: next },
      {
        onSuccess: () => {
          close();
          toast.success(t("settings.passwordChangedSignedOut"));
          void navigate({ to: "/login" });
        },
      },
    );
  }

  return (
    <SettingRow
      label={t("settings.password")}
      hint={
        changedAt === null
          ? undefined
          : `${t("settings.passwordChangedAt")}: ${formatDateTime(changedAt, lang)}`
      }
      control={
        open ? null : (
          <ActionButton onClick={() => setOpen(true)}>{t("settings.passwordChange")}</ActionButton>
        )
      }
    >
      {open && (
        <form onSubmit={submit} className="max-w-md space-y-4" noValidate>
          <p className="border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
            {t("settings.passwordChangeSignsOut")}
          </p>
          <FieldInput
            id="pw-current"
            label={t("settings.passwordCurrent")}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
          />
          <div>
            <FieldInput
              id="pw-new"
              label={t("settings.passwordNew")}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={setNext}
              {...(same ? { error: t("settings.passwordSame") } : {})}
            />
            <StrengthMeter password={next} problems={problems} strength={strength} />
          </div>
          <FieldInput
            id="pw-repeat"
            label={t("settings.passwordRepeat")}
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={setRepeat}
            {...(mismatch ? { error: t("settings.passwordMismatch") } : {})}
          />

          {serverError && (
            <ErrorNote>
              {serverError.message}
              {serverProblems.length > 1 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 font-normal">
                  {serverProblems.slice(1).map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              )}
            </ErrorNote>
          )}
          {touched && !valid && !serverError && problems.length > 0 && (
            <p className="text-xs font-semibold text-destructive">{problems[0]}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <ActionButton
              type="submit"
              variant="primary"
              busy={change.isPending}
              disabled={change.isPending}
            >
              {t("settings.passwordChange")}
            </ActionButton>
            <ActionButton variant="quiet" onClick={close}>
              {t("common.cancel")}
            </ActionButton>
          </div>
        </form>
      )}
    </SettingRow>
  );
}

/** The register screen's meter, at the size a single row can carry. */
function StrengthMeter({
  password,
  problems,
  strength,
}: {
  password: string;
  problems: string[];
  strength: 0 | 1 | 2 | 3;
}) {
  const t = useT();
  if (password === "") {
    return <p className="type-caption mt-2">{t("auth.passwordHint")}</p>;
  }
  const tone = strength >= 2 ? "bg-success" : "bg-destructive";
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
      {problems.length > 0 && (
        <ul className="space-y-1">
          {problems.map((problem) => (
            <li key={problem} className="text-xs text-destructive">
              {problem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --- a verified phone or e-mail -------------------------------------------- */
function ContactRow({
  channel,
  icon: Icon,
  label,
  value,
  display,
  verified,
}: {
  channel: ContactChannelKey;
  icon: typeof Mail;
  label: string;
  value: string | null;
  display: string | null;
  verified: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <SettingRow
      label={label}
      hint={
        <span className="flex flex-wrap items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span
            className={value === null ? "text-muted-foreground" : "font-semibold text-foreground"}
          >
            {display ?? t("settings.notSet")}
          </span>
          {value !== null && (
            <span
              className={cn(
                "type-label px-1.5 py-0.5",
                verified ? "bg-success-soft text-success" : "bg-warning/15 text-warning-foreground",
              )}
            >
              {verified ? t("settings.verified") : t("settings.notVerified")}
            </span>
          )}
        </span>
      }
      control={
        open ? null : (
          <ActionButton
            onClick={() => {
              setDone(false);
              setOpen(true);
            }}
          >
            {value === null ? t("settings.add") : t("settings.change")}
          </ActionButton>
        )
      }
    >
      {done && !open && <SuccessNote>{t("settings.contactChanged")}</SuccessNote>}
      {open && (
        <ContactChangeFlow
          channel={channel}
          label={label}
          onClose={() => setOpen(false)}
          onDone={() => {
            setDone(true);
            setOpen(false);
          }}
        />
      )}
    </SettingRow>
  );
}

/**
 * The new contact, then the code that proves it.
 *
 * Kept in one component because the second step needs the value from the first
 * and nothing else: lifting it would mean holding a half-finished phone number in
 * the card above for no reason.
 *
 * There is no resend endpoint and none is needed — `POST /me/security/contacts`
 * issues a fresh code every time, under the same 5/hour limit a second path would
 * have carried, so "send it again" is the same call with the same value.
 *
 * The number is normalised here before it is sent, so somebody who typed
 * `90 123 45 67` can see which account contact they are about to create. The
 * server normalises it again with `require_uz_phone` and stays the authority.
 */
function ContactChangeFlow({
  channel,
  label,
  onClose,
  onDone,
}: {
  channel: ContactChannelKey;
  label: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const start = useStartContactChange();
  const verify = useVerifyContactChange();

  const [raw, setRaw] = useState("");
  /** Set once a code is on its way; holds the value the server was given. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);

  const isPhone = channel === "PHONE";
  const canonical = isPhone ? normaliseUzPhone(raw) : raw.trim().toLowerCase();
  const ok = isPhone ? canonical !== null : looksLikeEmail(canonical ?? "");
  const fieldError =
    touched && !ok
      ? isPhone
        ? "Telefon raqami noto'g'ri. Masalan: +998 90 123 45 67"
        : "E-pochta manzili noto'g'ri."
      : undefined;

  const error = [start.error, verify.error].find(
    (candidate): candidate is ApiError => candidate instanceof ApiError,
  );

  function send(value: string) {
    start.mutate(
      { channel, value },
      {
        onSuccess: (result) => {
          // The server echoes the value it stored, which is the normalised one —
          // so the code screen names what the code actually went to.
          setSentTo(result.value);
          setDevCode(result.debug_code ?? null);
          setCode("");
        },
      },
    );
  }

  if (sentTo !== null) {
    return (
      <form
        className="max-w-md space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (code.length < 6 || verify.isPending) return;
          verify.mutate({ channel, value: sentTo, code }, { onSuccess: onDone });
        }}
      >
        <p className="type-caption">
          Tasdiqlash kodi{" "}
          <span className="font-semibold text-foreground">
            {isPhone ? prettyUzPhone(sentTo) : sentTo}
          </span>{" "}
          manziliga yuborildi. Kod kiritilmaguncha hisobingizdagi ma'lumot o'zgarmaydi.
        </p>

        <FieldInput
          id={`contact-code-${channel}`}
          label="Tasdiqlash kodi"
          value={code}
          onChange={(next) => setCode(next.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={6}
        />

        {/* Only ever populated where the SMS gateway writes to a log instead of
            to a phone, and labelled as the development aid it is rather than
            dressed up as something the person received. */}
        {devCode !== null && devCode !== "" && (
          <p className="border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
            <span className="type-label block">{t("settings.devNote")}</span>
            Kod: <span className="font-mono font-bold">{devCode}</span>
          </p>
        )}

        {error && <ErrorNote>{error.message}</ErrorNote>}

        <div className="flex flex-wrap gap-2">
          <ActionButton
            type="submit"
            variant="primary"
            busy={verify.isPending}
            disabled={code.length < 6 || verify.isPending}
          >
            {t("settings.change")}
          </ActionButton>
          <ActionButton
            variant="outline"
            busy={start.isPending}
            disabled={start.isPending}
            onClick={() => send(sentTo)}
          >
            {t("settings.resendCode")}
          </ActionButton>
          <ActionButton
            variant="quiet"
            onClick={() => {
              setSentTo(null);
              setCode("");
              setDevCode(null);
              verify.reset();
              start.reset();
            }}
          >
            {t("common.back")}
          </ActionButton>
        </div>
      </form>
    );
  }

  return (
    <form
      className="max-w-md space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!ok || canonical === null || start.isPending) return;
        send(canonical);
      }}
    >
      <FieldInput
        id={`contact-new-${channel}`}
        label={`Yangi ${label.toLowerCase()}`}
        value={raw}
        onChange={setRaw}
        type={isPhone ? "text" : "email"}
        inputMode={isPhone ? "tel" : "email"}
        autoComplete={isPhone ? "tel" : "email"}
        placeholder={isPhone ? "+998 90 123 45 67" : "ism@example.uz"}
        {...(fieldError !== undefined
          ? { error: fieldError }
          : isPhone && canonical !== null
            ? { hint: `Saqlanadigan ko'rinish: ${prettyUzPhone(canonical)}` }
            : { hint: t("settings.contactChangeHint") })}
      />
      {error && <ErrorNote>{error.message}</ErrorNote>}
      <div className="flex flex-wrap gap-2">
        <ActionButton
          type="submit"
          variant="primary"
          busy={start.isPending}
          disabled={start.isPending}
        >
          Kod yuborish
        </ActionButton>
        <ActionButton variant="quiet" onClick={onClose}>
          {t("common.cancel")}
        </ActionButton>
      </div>
    </form>
  );
}
