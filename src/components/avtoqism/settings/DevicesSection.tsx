/**
 * Every browser that holds a live session on this account.
 *
 * This is the screen somebody opens because they suspect something, so it is
 * written for that moment: the device they are looking at is marked so they do
 * not end it by mistake, each row says when it was last used and from which
 * address, and "end everywhere else" is one action rather than a row-by-row
 * chore.
 *
 * Two things the server owns and this file does not second-guess:
 *
 *   - **the device name.** `settings/user_agent.py` parses it and `SessionOut`
 *     sends it. Parsing the user agent again here would give two answers for one
 *     session, and the client's would be the one nobody could correct.
 *   - **which session is current.** It comes from the access token's `sid`
 *     claim. A client-side guess would either mark the wrong row or offer to end
 *     the session doing the asking.
 *
 * `last_used_at` is when the session last exchanged its refresh token, not its
 * last request — the API says so in as many words and sends the caveat with the
 * list, so the card prints it instead of letting an hours-old timestamp look like
 * a bug.
 *
 * Both destructive actions confirm in place, with the row still visible next to
 * the question, so the answer cannot be given about the wrong device.
 */
import { useState } from "react";
import { Laptop, MapPin, MonitorSmartphone, Smartphone, Tablet } from "lucide-react";

import { ActionButton, DangerConfirm, ErrorNote, SettingsCard, SuccessNote } from "./Primitives";
import { ErrorState } from "@/components/avtoqism/States";
import { formatDateTime } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { useEndOtherSessions, useEndSession, useSessions } from "@/lib/query/settings";
import type { SessionOut } from "@/lib/query/settings";
import { cn } from "@/lib/utils";

export const DEVICES_ID = "qurilmalar";

/**
 * Which icon, from the name the server already produced.
 *
 * A guess about the shape of the thing, not about its identity — so it reads the
 * finished label rather than the raw user agent, and falls back to a laptop,
 * which is the least wrong picture of an unknown browser.
 */
function iconFor(device: string) {
  if (/iPad|Tablet|planshet/i.test(device)) return Tablet;
  if (/iPhone|Android|Mobile|telefon/i.test(device)) return Smartphone;
  return Laptop;
}

export function DevicesSection() {
  const t = useT();
  const { lang } = useLang();
  const sessions = useSessions();
  const endOne = useEndSession();
  const endOthers = useEndOtherSessions();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [ended, setEnded] = useState<number | null>(null);

  const rows = sessions.data?.sessions ?? [];
  const others = rows.filter((session) => !session.is_current);

  return (
    <SettingsCard
      id={DEVICES_ID}
      icon={MonitorSmartphone}
      title={t("settings.devices")}
      subtitle={t("settings.devicesSub")}
      footer={
        others.length === 0 ? (
          <p className="type-caption">{t("settings.noOtherDevices")}</p>
        ) : confirmingAll ? (
          <DangerConfirm
            question={t("settings.endOthers")}
            detail={t("settings.endOthersConfirm")}
            confirmLabel={t("settings.endOthers")}
            cancelLabel={t("common.cancel")}
            busy={endOthers.isPending}
            onCancel={() => setConfirmingAll(false)}
            onConfirm={() =>
              endOthers.mutate(undefined, {
                onSuccess: (result) => {
                  setEnded(result.revoked);
                  setConfirmingAll(false);
                },
              })
            }
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="type-caption">{others.length} ta boshqa qurilmada hisobingiz ochiq.</p>
            <ActionButton variant="danger" onClick={() => setConfirmingAll(true)}>
              {t("settings.endOthers")}
            </ActionButton>
          </div>
        )
      }
    >
      {sessions.isPending ? (
        <div className="space-y-3 px-5 py-5 lg:px-6">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="h-14 animate-pulse bg-muted" />
          ))}
        </div>
      ) : sessions.isError ? (
        <div className="px-5 py-5 lg:px-6">
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} compact />
        </div>
      ) : rows.length === 0 ? (
        <p className="type-caption px-5 py-8 text-center lg:px-6">{t("common.empty")}</p>
      ) : (
        rows.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            lang={lang}
            confirming={confirmingId === session.id}
            busy={endOne.isPending && endOne.variables === session.id}
            failed={endOne.isError && endOne.variables === session.id ? endOne.error.message : null}
            onAsk={() => setConfirmingId(session.id)}
            onCancel={() => setConfirmingId(null)}
            onConfirm={() => endOne.mutate(session.id, { onSuccess: () => setConfirmingId(null) })}
          />
        ))
      )}

      {/* The server's own caveat about what these timestamps mean, said once. */}
      {sessions.data?.note && (
        <p className="type-caption px-5 py-4 lg:px-6">{sessions.data.note}</p>
      )}

      {ended !== null && (
        <div className="px-5 py-4 lg:px-6">
          <SuccessNote>
            {t("settings.endOthersDone")} — {ended} {t("settings.sessionsEnded")}.
          </SuccessNote>
        </div>
      )}
      {endOthers.isError && (
        <div className="px-5 py-4 lg:px-6">
          <ErrorNote>{endOthers.error.message}</ErrorNote>
        </div>
      )}
    </SettingsCard>
  );
}

function SessionRow({
  session,
  lang,
  confirming,
  busy,
  failed,
  onAsk,
  onCancel,
  onConfirm,
}: {
  session: SessionOut;
  lang: "uz" | "ru";
  confirming: boolean;
  busy: boolean;
  failed: string | null;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const name = session.device.trim() || t("settings.unknownDevice");
  const Icon = iconFor(session.device);
  const place = session.ip_address?.trim() ?? null;
  const lastUsed = session.last_used_at ?? session.created_at;

  return (
    <div className="px-5 py-4 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-56 items-start gap-3">
          <Icon
            className={cn(
              "mt-0.5 size-5 shrink-0",
              session.is_current ? "text-primary" : "text-muted-foreground",
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {name}
              {session.is_current && (
                <span className="type-label bg-primary px-1.5 py-0.5 text-primary-foreground">
                  {t("settings.thisDevice")}
                </span>
              )}
            </p>
            <p className="type-caption mt-1 flex flex-wrap items-center gap-x-2">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {place ?? t("settings.unknownPlace")}
            </p>
            <p className="type-caption">
              {t("settings.lastUsed")}: {formatDateTime(lastUsed, lang)}
            </p>
          </div>
        </div>

        {/*
         * No "end" button on the current session. `DELETE /me/sessions/{id}`
         * would happily end it — the server calls that a logout — but somebody
         * reaching for it in a device list has almost certainly aimed at the
         * wrong row, and signing out is a button in the account card below.
         */}
        {!session.is_current && !confirming && (
          <ActionButton variant="danger" onClick={onAsk}>
            {t("settings.endSession")}
          </ActionButton>
        )}
      </div>

      {confirming && (
        <div className="mt-4">
          <DangerConfirm
            question={`${name} — ${t("settings.endSession")}?`}
            detail="Bu qurilmada hisobingiz yopiladi. Kirish uchun parol yana kerak bo'ladi."
            confirmLabel={t("settings.endSession")}
            cancelLabel={t("common.cancel")}
            busy={busy}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        </div>
      )}

      {failed && !confirming && (
        <div className="mt-3">
          <ErrorNote>{failed}</ErrorNote>
        </div>
      )}
    </div>
  );
}
