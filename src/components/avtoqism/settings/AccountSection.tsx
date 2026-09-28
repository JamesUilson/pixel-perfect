/**
 * Signing out, and closing the account for good.
 *
 * The two are in one card because they are the two ways of leaving, and they are
 * separated by a hairline and a great deal of wording because only one of them is
 * reversible.
 *
 * Closing the account is written to be read before it is done. It states what goes
 * and, more importantly, what stays: order and payment history is kept, because it
 * is a financial record — a receipt the buyer may need, a document the platform is
 * obliged to be able to produce, and the other side of a transaction a seller also
 * has a claim on. Somebody who expected "delete account" to erase their invoices
 * deserves to learn that here, not from support.
 *
 * `DELETE /me` answers with its own `kept` and `removed` lists rather than 204,
 * precisely so that answer can be shown. It is shown — the lists below the button
 * are the pre-warning, because the person needs them *before* deciding, and the
 * server's own words are what appears afterwards. Neither is a paraphrase of the
 * other's policy: the pre-warning names the same four kept records the API does,
 * and if the retention policy changes the server's reply is the one that has
 * moved, which is the version the person ends up reading.
 *
 * It does not ask for a password, because `AccountCloseIn` has no field for one. A
 * password box whose contents the server discards is worse than none — it promises
 * a check that is not happening. The two-step confirmation is the whole of the
 * friction, and the account is already behind a live session.
 */
import { useState } from "react";
import { LogOut, Trash2, UserRound } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import {
  ActionButton,
  DangerConfirm,
  ErrorNote,
  FieldInput,
  SettingRow,
  SettingsCard,
} from "./Primitives";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { useLogout } from "@/lib/query/auth";
import { useCloseAccount } from "@/lib/query/settings";
import type { AccountClosedOut } from "@/lib/query/settings";

export const ACCOUNT_ID = "hisob";

/**
 * The warning, before the call that would produce the server's own version.
 *
 * Kept short and in the same four-and-two shape as `KEPT_ON_CLOSE` and
 * `REMOVED_ON_CLOSE` in `app/modules/settings/service.py`. The server's full
 * reasons are longer than a decision needs; they are what gets shown after.
 */
const REMOVED = [
  "Barcha qurilmalardagi seanslar — hisobga endi kirilmaydi",
  "Login va parol bilan kirish huquqi",
  "Profil ma'lumotlari, garaj, savat va obunalar",
];

const KEPT = [
  "Buyurtmalar tarixi — moliyaviy hujjat, qonuniy muddat davomida saqlanadi",
  "To'lov va hisob-kitob yozuvlari (karta raqamlari saqlanmaydi)",
  "Cheklar va qaytarishlar — kelishmovchilikda faktni faqat shular tasdiqlaydi",
  "Moderatsiya qarorlari",
];

export function AccountSection({
  onClosed,
}: {
  /**
   * Handed the server's answer, which the *route* renders.
   *
   * It cannot be rendered here: closing the account ends the session, which
   * flips `useIsAuthenticated` and unmounts this card along with the rest of the
   * signed-in sections. The last thing this account is ever shown would have
   * lasted about one frame.
   */
  onClosed: (result: AccountClosedOut) => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const logout = useLogout();
  const close = useCloseAccount();

  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  const error = close.error instanceof ApiError ? close.error : null;

  return (
    <SettingsCard
      id={ACCOUNT_ID}
      icon={UserRound}
      title={t("settings.account")}
      subtitle={t("settings.accountSub")}
    >
      <SettingRow
        label={t("auth.logout")}
        hint="Shu qurilmada hisobdan chiqasiz. Boshqa qurilmalar ochiq qoladi — ularni «Ulangan qurilmalar»dan yopasiz."
        control={
          <ActionButton
            busy={logout.isPending}
            disabled={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, { onSuccess: () => void navigate({ to: "/" }) })
            }
          >
            <LogOut className="size-4" aria-hidden />
            {t("auth.logout")}
          </ActionButton>
        }
      />

      <SettingRow
        label={t("settings.closeAccount")}
        hint="Bu amalni qaytarib bo'lmaydi. Quyida nima o'chishi va nima saqlanishi yozilgan."
        control={
          confirming ? null : (
            <ActionButton variant="danger" onClick={() => setConfirming(true)}>
              <Trash2 className="size-4" aria-hidden />
              {t("settings.closeAccount")}
            </ActionButton>
          )
        }
      >
        <RetentionColumns removed={REMOVED} kept={KEPT} />

        {confirming && (
          <div className="mt-4">
            <DangerConfirm
              question={t("settings.closeAccount")}
              detail={t("settings.closeAccountNoPassword")}
              confirmLabel={t("settings.closeAccount")}
              cancelLabel={t("common.cancel")}
              busy={close.isPending}
              onCancel={() => {
                setConfirming(false);
                setReason("");
                close.reset();
              }}
              onConfirm={() => {
                if (close.isPending) return;
                close.mutate(
                  { reason: reason.trim() === "" ? undefined : reason.trim() },
                  {
                    onSuccess: (result) => {
                      onClosed(result);
                      // The session is already revoked server-side; clearing it
                      // locally is what stops the app from retrying with a dead
                      // token. No navigation — the receipt is the point.
                      logout.mutate();
                    },
                  },
                );
              }}
            >
              <div className="space-y-4">
                <FieldInput
                  id="close-reason"
                  label={t("settings.closeAccountReason")}
                  value={reason}
                  onChange={setReason}
                  maxLength={300}
                  hint={`${t("common.optional")} — faqat qo'llab-quvvatlash xizmati o'qiydi.`}
                />
                {error && <ErrorNote>{error.message}</ErrorNote>}
              </div>
            </DangerConfirm>
          </div>
        )}
      </SettingRow>
    </SettingsCard>
  );
}

function RetentionColumns({ removed, kept }: { removed: string[]; kept: string[] }) {
  const t = useT();
  return (
    <div className="grid gap-px bg-border sm:grid-cols-2">
      <div className="bg-card p-4">
        <p className="type-label text-destructive">{t("settings.closeAccountWhat")}</p>
        <ul className="mt-3 space-y-2">
          {removed.map((line) => (
            <li key={line} className="type-caption flex gap-2">
              <span aria-hidden className="mt-1.5 size-1 shrink-0 bg-destructive" />
              {line}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-card p-4">
        <p className="type-label text-muted-foreground">{t("settings.closeAccountKept")}</p>
        <ul className="mt-3 space-y-2">
          {kept.map((line) => (
            <li key={line} className="type-caption flex gap-2">
              <span aria-hidden className="mt-1.5 size-1 shrink-0 bg-border-strong" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The server's own answer, kept on screen.
 *
 * This is the last thing this account will ever be shown, so it is the server's
 * wording rather than a summary of it — including the sentence about writing to
 * support, which is the only route back.
 */
export function ClosedReceipt({ result }: { result: AccountClosedOut }) {
  const t = useT();
  const { lang } = useLang();
  return (
    <SettingsCard
      id={ACCOUNT_ID}
      icon={UserRound}
      title={t("settings.closeAccountDone")}
      subtitle={formatDateTime(result.closed_at, lang)}
    >
      <div className="px-5 py-4 lg:px-6">
        <p className="text-sm">{result.message}</p>
        <p className="type-caption mt-2">
          {result.sessions_ended} {t("settings.sessionsEnded")}.
        </p>
      </div>

      <div className="px-5 py-4 lg:px-6">
        <div className="grid gap-px bg-border sm:grid-cols-2">
          <div className="bg-card p-4">
            <p className="type-label text-destructive">{t("settings.closeAccountWhat")}</p>
            <dl className="mt-3 space-y-3">
              {result.removed.map((note) => (
                <div key={note.what}>
                  <dt className="text-sm font-semibold">{note.what}</dt>
                  <dd className="type-caption mt-0.5">{note.why}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="bg-card p-4">
            <p className="type-label text-muted-foreground">{t("settings.closeAccountKept")}</p>
            <dl className="mt-3 space-y-3">
              {result.kept.map((note) => (
                <div key={note.what}>
                  <dt className="text-sm font-semibold">{note.what}</dt>
                  <dd className="type-caption mt-0.5">{note.why}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
