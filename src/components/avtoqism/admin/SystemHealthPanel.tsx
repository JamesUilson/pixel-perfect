/**
 * Tizim holati — the screen someone opens at two in the morning.
 *
 * It is ordered by the questions that actually get asked, in the order they get
 * asked: is the database there and how slow is it, is the code running against
 * the schema it expects, are the side services up, and is anything piling up
 * that should not be.
 *
 * The migration row is given its own block rather than a cell in the grid.
 * "The code is new and the schema is not" is the single most common cause of a
 * release that looks broken, and it is the first thing worth ruling out.
 *
 * Every probe is wrapped on the server, so a check that failed reports itself
 * as failed and the rest of the payload still arrives. This page renders that
 * the same way: one dead service costs one card.
 */
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import { Button, Pill } from "@/components/avtoqism/panel/Widgets";
import { formatDateTime, groupDigits } from "@/lib/format";
import { useSystemHealth, type SystemHealth } from "@/lib/query/admin";

type Tone = "neutral" | "good" | "warning" | "critical" | "info";

const STATUS_UZ: Record<string, { label: string; tone: Tone }> = {
  ok: { label: "Ishlayapti", tone: "good" },
  degraded: { label: "Cheklangan", tone: "warning" },
  down: { label: "Ishlamayapti", tone: "critical" },
  unknown: { label: "Noma'lum", tone: "neutral" },
  not_configured: { label: "Sozlanmagan", tone: "neutral" },
};

function state(status: string | undefined): { label: string; tone: Tone } {
  return STATUS_UZ[status ?? "unknown"] ?? { label: status ?? "—", tone: "neutral" };
}

function ms(value: number | undefined): string {
  return value === undefined ? "—" : `${value.toFixed(value < 10 ? 2 : 0)} ms`;
}

export function SystemHealthPanel({ lang }: { lang: "uz" | "ru" }) {
  const health = useSystemHealth();

  if (health.isPending) {
    return (
      <PanelSection title="Tizim holati">
        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="bg-card p-5">
              <LineSkeleton className="mb-4 h-3 w-24" />
              <LineSkeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
      </PanelSection>
    );
  }

  if (health.isError) {
    return (
      <PanelSection title="Tizim holati">
        <div className="p-5">
          <ErrorState error={health.error} onRetry={() => void health.refetch()} />
        </div>
      </PanelSection>
    );
  }

  const data = health.data;

  return (
    <div className="space-y-6">
      <Overall
        data={data}
        lang={lang}
        onRefresh={() => void health.refetch()}
        busy={health.isFetching}
      />
      <MigrationBlock data={data} />

      <PanelSection
        title="Xizmatlar"
        subtitle="Har bir tekshiruv alohida bajariladi — biri yiqilsa qolganlari baribir javob beradi."
      >
        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          <Card
            label="Ma'lumotlar bazasi"
            status={data.database.status}
            value={ms(data.database.latency_ms)}
            lines={[
              data.database.backend ? `baza: ${data.database.backend}` : null,
              data.database.error ?? null,
              "50 ms dan sekin javob «cheklangan» deb belgilanadi",
            ]}
          />
          <Card
            label="Redis"
            status={data.redis.status}
            value={data.redis.status === "not_configured" ? "—" : ms(data.redis.latency_ms)}
            lines={[
              data.redis.error ?? null,
              data.redis.impact ? `ta'siri: ${data.redis.impact}` : null,
              data.redis.status === "not_configured" ? "sozlamalarda ko'rsatilmagan" : null,
            ]}
          />
          <Card
            label="Fayl ombori"
            status={data.storage.status}
            value={data.storage.backend}
            lines={[
              data.storage.path ?? null,
              data.storage.bucket ? `bucket: ${data.storage.bucket}` : null,
              data.storage.writable === false ? "yozib bo'lmaydi" : null,
              data.storage.endpoint ?? null,
            ]}
          />
          <Card
            label="Muhit"
            status={data.app.env === "prod" ? "ok" : "unknown"}
            value={`${data.app.env} · ${data.app.version}`}
            lines={[
              data.app.debug ? "DEBUG yoqilgan" : "DEBUG o'chirilgan",
              `SMS: ${data.app.sms_provider}`,
              `To'lov: ${data.app.payment_provider_default}`,
              data.app.rate_limit_enabled
                ? "so'rov cheklovi yoqilgan"
                : "so'rov cheklovi o'chirilgan",
            ]}
          />
        </div>
      </PanelSection>

      <PanelSection
        title="Navbatlar"
        subtitle="Odamni kutayotgan ishlar va hech kim qaramaganda yuz bergan xatoliklar."
      >
        {data.queues.error ? (
          <p className="p-5 text-sm text-destructive">{data.queues.error}</p>
        ) : (
          <div className="grid gap-px bg-border sm:grid-cols-3">
            <Figure
              label="Ko'rib chiqilmagan do'konlar"
              value={groupDigits(data.queues.pending_stores ?? 0)}
              hint="«Sotuvchilar» bo'limidagi navbat"
              alarming={(data.queues.pending_stores ?? 0) > 0}
            />
            <Figure
              label="Hal qilinmagan to'lovlar"
              value={groupDigits(data.queues.pending_payouts ?? 0)}
              hint="so'ralgan, tasdiqlangan yoki jarayondagi"
              alarming={(data.queues.pending_payouts ?? 0) > 0}
            />
            <Figure
              label="Muvaffaqiyatsiz to'lovlar"
              value={groupDigits(data.queues.failed_payments_24h ?? 0)}
              hint="oxirgi 24 soatda"
              alarming={(data.queues.failed_payments_24h ?? 0) > 0}
            />
          </div>
        )}
      </PanelSection>

      <TrafficBlock data={data} />
    </div>
  );
}

function Overall({
  data,
  lang,
  onRefresh,
  busy,
}: {
  data: SystemHealth;
  lang: "uz" | "ru";
  onRefresh: () => void;
  busy: boolean;
}) {
  const overall = state(data.status);
  const bad = data.status !== "ok";

  return (
    <section
      role={bad ? "alert" : undefined}
      className={
        bad
          ? "flex flex-wrap items-start gap-3 border-2 border-destructive bg-destructive/8 px-5 py-4"
          : "flex flex-wrap items-start gap-3 border border-success/40 bg-success-soft px-5 py-4"
      }
    >
      {bad ? (
        <AlertTriangle className="mt-0.5 size-6 shrink-0 text-destructive" aria-hidden />
      ) : (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={
            bad ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-success"
          }
        >
          {data.app.name} — {overall.label}
        </p>
        <p className="type-caption mt-1">
          Tekshirilgan: {formatDateTime(data.checked_at, lang)} · har 30 soniyada yangilanadi.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onRefresh} disabled={busy}>
        <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} aria-hidden />
        Yangilash
      </Button>
    </section>
  );
}

/**
 * Migrations get their own block because the answer is a comparison, not a
 * status: what the database says it is at, against what the code's head is.
 */
function MigrationBlock({ data }: { data: SystemHealth }) {
  const current = data.migrations.current ?? null;
  const head = data.migrations.head ?? null;
  const matched = current !== null && head !== null && current === head;
  const unknown = current === null || head === null;

  return (
    <section
      role={!matched && !unknown ? "alert" : undefined}
      className={
        matched
          ? "border border-success/40 bg-success-soft px-5 py-4"
          : unknown
            ? "border border-border bg-card px-5 py-4"
            : "border-2 border-destructive bg-destructive/8 px-5 py-4"
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="type-h3">Migratsiyalar</h3>
        <Pill tone={matched ? "good" : unknown ? "neutral" : "critical"}>
          {matched ? "Moslashgan" : unknown ? "Aniqlanmadi" : "Mos emas"}
        </Pill>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="type-label text-muted-foreground">Bazadagi reviziya</dt>
          <dd className="mt-0.5 font-mono text-xs">{current ?? "—"}</dd>
        </div>
        <div>
          <dt className="type-label text-muted-foreground">Kod kutayotgan reviziya</dt>
          <dd className="mt-0.5 font-mono text-xs">{head ?? "—"}</dd>
        </div>
      </dl>

      <p className="type-caption mt-3 max-w-3xl">
        {matched
          ? "Baza kod kutayotgan sxemada. Yomon relizdan keyingi birinchi savol shu edi — javob ijobiy."
          : unknown
            ? "Reviziyalarni solishtirib bo'lmadi. Ko'pincha bu — alembic_version jadvali yo'qligini bildiradi: baza migratsiyalarsiz qurilgan."
            : "Bazadagi sxema kod kutayotganidan farq qiladi. Yangi reliz eski bazada ishlayapti — migratsiyalarni qo'llang, aks holda xatoliklar tasodifiy ko'rinadi."}
        {data.migrations.error ? ` (${data.migrations.error})` : ""}
      </p>
    </section>
  );
}

function TrafficBlock({ data }: { data: SystemHealth }) {
  const byClass = data.traffic.by_status_class ?? {};
  const classes = Object.keys(byClass).sort();
  const sample = data.traffic.sample_rate;

  return (
    <PanelSection
      title="Oxirgi 24 soat"
      subtitle="So'rovlar jurnalidan olingan yig'indi: nosozlik hammada yoki bitta odamdami."
    >
      <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        {classes.length === 0 ? (
          <Figure label="So'rovlar" value="0" hint="oxirgi 24 soatda yozuv yo'q" />
        ) : (
          classes.map((klass) => (
            <Figure
              key={klass}
              label={`${klass} javoblar`}
              value={groupDigits(byClass[klass] ?? 0)}
              hint={klass === "5xx" ? "server xatolari" : klass === "4xx" ? "mijoz xatolari" : ""}
              alarming={klass === "5xx" && (byClass[klass] ?? 0) > 0}
            />
          ))
        )}
        <Figure
          label="Eng sekin so'rov"
          value={ms(data.traffic.slowest_ms)}
          hint="oxirgi 24 soatda"
        />
      </div>

      {data.traffic.top_errors && data.traffic.top_errors.length > 0 && (
        <ul className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
          {data.traffic.top_errors.map((error) => (
            <li key={error.code}>
              <Pill tone="critical">
                {error.code} · {groupDigits(error.count)}
              </Pill>
            </li>
          ))}
        </ul>
      )}

      <p className="type-caption border-t border-border px-5 py-3">
        Jurnalda jami {groupDigits(data.traffic.request_log_rows ?? 0)} ta so'rov va{" "}
        {groupDigits(data.traffic.audit_log_rows ?? 0)} ta audit yozuvi bor
        {data.traffic.retention_days
          ? `; yozuvlar ${groupDigits(data.traffic.retention_days)} kun saqlanadi`
          : ""}
        {sample !== undefined
          ? `. Muvaffaqiyatli o'qishlar ${Math.round(sample * 100)}% ulushida yoziladi`
          : ""}
        .
      </p>
    </PanelSection>
  );
}

function Card({
  label,
  status,
  value,
  lines,
}: {
  label: string;
  status: string;
  value: string;
  lines: (string | null)[];
}) {
  const tone = state(status);
  return (
    <div className="bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="type-label text-muted-foreground">{label}</p>
        <Pill tone={tone.tone}>{tone.label}</Pill>
      </div>
      <p className="font-display mt-3 break-words text-[1.25rem] font-semibold leading-tight tracking-tight">
        {value}
      </p>
      <ul className="mt-3 space-y-1">
        {lines
          .filter((line): line is string => Boolean(line))
          .map((line) => (
            <li key={line} className="type-caption break-words">
              {line}
            </li>
          ))}
      </ul>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  alarming = false,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  alarming?: boolean | undefined;
}) {
  return (
    <div className="bg-card p-5">
      <p className="type-label text-muted-foreground">{label}</p>
      <p
        className={
          alarming
            ? "font-display mt-3 text-[1.5rem] font-semibold leading-none tracking-tight text-destructive"
            : "font-display mt-3 text-[1.5rem] font-semibold leading-none tracking-tight"
        }
      >
        {value}
      </p>
      {hint && <p className="type-caption mt-3">{hint}</p>}
    </div>
  );
}
