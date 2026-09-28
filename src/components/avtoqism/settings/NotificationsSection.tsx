/**
 * Which messages, on which channel.
 *
 * A grid rather than a column of twenty switches: the event kinds down the side,
 * the four channels across, and somebody scanning for "stop texting me" finds
 * one column instead of reading every line.
 *
 * The rows come from the server. `NOTIFIABLE_KINDS` on the API side is
 * deliberately shorter than `NotificationKind` — it lists only the kinds
 * something in the codebase actually produces today — so rendering whatever
 * arrives is what keeps this screen honest: a switch for a notification that can
 * never be sent teaches people that none of the switches work. A kind that
 * arrives without an Uzbek label is shown by its own code rather than dropped.
 *
 * What is *not* here matters as much. Order receipts, payment confirmations and
 * refunds have no switch, because they are a financial record the platform has to
 * be able to prove it sent. The card says so under the grid, rather than leaving
 * somebody to discover it when a receipt arrives after they switched everything
 * off.
 *
 * Each cell writes on change — no save button, so nothing is left half-applied by
 * a person who closes the tab. `PATCH /me/preferences` answers with the whole new
 * state, which replaces the cache, so a refusal corrects the cell rather than
 * leaving it lying.
 */
import { Bell } from "lucide-react";

import { CheckChip, ErrorNote, SettingsCard } from "./Primitives";
import { ErrorState } from "@/components/avtoqism/States";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { NOTIFICATION_CHANNELS, usePreferences, useUpdatePreferences } from "@/lib/query/settings";
import type { NotificationChannels, NotificationChannelKey } from "@/lib/query/settings";

export const NOTIFICATIONS_ID = "bildirishnomalar";

export function NotificationsSection() {
  const t = useT();
  const prefs = usePreferences();
  const update = useUpdatePreferences();

  const rows = prefs.data?.notifications ?? [];
  const error = update.error instanceof ApiError ? update.error : null;

  return (
    <SettingsCard
      id={NOTIFICATIONS_ID}
      icon={Bell}
      title={t("settings.notifications")}
      subtitle={t("settings.notificationsSub")}
      footer={
        <>
          <p className="type-caption">{t("settings.notificationsAlways")}</p>
          <p className="type-caption mt-2">{t("settings.smsNote")}</p>
        </>
      }
    >
      {prefs.isPending ? (
        <div className="space-y-3 px-5 py-5 lg:px-6">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-16 animate-pulse bg-muted" />
          ))}
        </div>
      ) : prefs.isError ? (
        <div className="px-5 py-5 lg:px-6">
          <ErrorState error={prefs.error} onRetry={() => void prefs.refetch()} compact />
        </div>
      ) : rows.length === 0 ? (
        <p className="type-caption px-5 py-8 text-center lg:px-6">{t("common.empty")}</p>
      ) : (
        rows.map((row) => <KindRow key={row.kind} row={row} update={update} />)
      )}

      {error && (
        <div className="px-5 py-4 lg:px-6">
          <ErrorNote>{error.message}</ErrorNote>
        </div>
      )}
    </SettingsCard>
  );
}

function KindRow({
  row,
  update,
}: {
  row: NotificationChannels;
  /**
   * The card's one mutation, passed down rather than created here.
   *
   * `PATCH /me/preferences` answers with the whole new preference state, which
   * replaces the cache — so two writes in flight can land in the wrong order and
   * the loser silently wins. One mutation for the card means one `isPending`,
   * which disables every chip while a write is out, and means the card's error
   * note is attached to the mutation that actually failed.
   */
  update: ReturnType<typeof useUpdatePreferences>;
}) {
  const t = useT();

  // `useT` answers with the key when there is no entry, which is how an unlabelled
  // new kind still renders something rather than an empty row.
  const title = t(`notify.${row.kind}`);
  const detail = t(`notify.${row.kind}.sub`);
  const hasDetail = detail !== `notify.${row.kind}.sub`;

  return (
    <div className="px-5 py-4 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-semibold">{title}</p>
          {hasDetail && <p className="type-caption mt-1">{detail}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {NOTIFICATION_CHANNELS.map((channel) => (
            <CheckChip
              key={channel.key}
              id={`notify-${row.kind}-${channel.key}`}
              label={t(`settings.channel.${channel.key}`)}
              checked={row[channel.key]}
              disabled={update.isPending}
              onChange={(next) =>
                update.mutate({ notifications: [channelPatch(row.kind, channel.key, next)] })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * One channel of one kind, as `NotificationChannelsIn` wants it.
 *
 * Only the changed channel is sent: the server leaves an omitted one alone, so a
 * client that has never heard of a channel cannot switch it off by not mentioning
 * it. Built in a function with a declared return type rather than inline, so the
 * computed key is checked against the patch shape instead of widening to `string`.
 */
function channelPatch(
  kind: string,
  channel: NotificationChannelKey,
  value: boolean,
): { kind: string } & Partial<Record<NotificationChannelKey, boolean>> {
  return { kind, [channel]: value };
}
