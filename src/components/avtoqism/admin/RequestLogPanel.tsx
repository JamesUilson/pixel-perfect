/**
 * So'rovlar jurnali — every request the API handled, newest first.
 *
 * Two things make this table honest rather than misleading.
 *
 * Successful reads are sampled: the server writes only a fraction of them, and
 * the fraction is a server setting, not something this screen can change. An
 * empty table therefore means "nothing matched the filter", never "the platform
 * is idle" and never "the platform is down". The rate is read from the health
 * payload and printed above the table so nobody has to remember that.
 *
 * Dates are sent as typed and read as UTC by the server, so the field says so
 * instead of quietly shifting by five hours.
 *
 * Filters are applied on submit rather than on every keystroke: a log table
 * that refetches per character is a log table that rate-limits its own
 * operator.
 */
import { useState } from "react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import {
  Button,
  Cell,
  DataTable,
  Field,
  Input,
  Panel,
  Pill,
  Row,
  Select,
} from "@/components/avtoqism/panel/Widgets";
import { formatDateTime } from "@/lib/format";
import {
  useRequestLogDetail,
  useRequestLogs,
  useSystemHealth,
  type RequestLogFilters,
} from "@/lib/query/admin";
import { Pager } from "./Pager";

type Draft = {
  status_class: string;
  status_code: string;
  method: string;
  path_prefix: string;
  actor_id: string;
  error_code: string;
  date_from: string;
  date_to: string;
};

const EMPTY: Draft = {
  status_class: "",
  status_code: "",
  method: "",
  path_prefix: "",
  actor_id: "",
  error_code: "",
  date_from: "",
  date_to: "",
};

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const CLASSES = ["1xx", "2xx", "3xx", "4xx", "5xx"];

function toFilters(draft: Draft, page: number, size: number): RequestLogFilters {
  const parsed = Number.parseInt(draft.status_code, 10);
  return {
    status_class: draft.status_class || null,
    status_code: Number.isFinite(parsed) ? parsed : null,
    method: draft.method || null,
    path_prefix: draft.path_prefix.trim() || null,
    actor_id: draft.actor_id.trim() || null,
    error_code: draft.error_code.trim() || null,
    date_from: draft.date_from || null,
    date_to: draft.date_to || null,
    page,
    size,
  };
}

function statusTone(code: number): "good" | "info" | "warning" | "critical" | "neutral" {
  if (code >= 500) return "critical";
  if (code >= 400) return "warning";
  if (code >= 300) return "info";
  if (code >= 200) return "good";
  return "neutral";
}

export function RequestLogPanel({ lang }: { lang: "uz" | "ru" }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [applied, setApplied] = useState<Draft>(EMPTY);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const [openId, setOpenId] = useState<string | null>(null);

  const logs = useRequestLogs(toFilters(applied, page, size));
  const health = useSystemHealth();
  const sample = health.data?.traffic.sample_rate;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <PanelSection
      title="So'rovlar jurnali"
      subtitle="Eng yangisi birinchi. Filtrlar faqat toraytiradi, hech qachon kengaytirmaydi."
    >
      <form
        className="grid gap-4 border-b border-border p-5 sm:grid-cols-2 xl:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setApplied(draft);
        }}
      >
        <Field label="Javob sinfi">
          <Select
            value={draft.status_class}
            onChange={(event) => set("status_class", event.target.value)}
          >
            <option value="">Hammasi</option>
            {CLASSES.map((klass) => (
              <option key={klass} value={klass}>
                {klass}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Aniq kod" hint="Masalan 404 yoki 500.">
          <Input
            value={draft.status_code}
            onChange={(event) => set("status_code", event.target.value)}
            inputMode="numeric"
            placeholder="500"
          />
        </Field>

        <Field label="Metod">
          <Select value={draft.method} onChange={(event) => set("method", event.target.value)}>
            <option value="">Hammasi</option>
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Yo'l boshlanishi" hint="Masalan /api/v1/admin.">
          <Input
            value={draft.path_prefix}
            onChange={(event) => set("path_prefix", event.target.value)}
            placeholder="/api/v1/"
            spellCheck={false}
          />
        </Field>

        <Field label="Aktor ID" hint="Foydalanuvchining UUID'i.">
          <Input
            value={draft.actor_id}
            onChange={(event) => set("actor_id", event.target.value)}
            placeholder="3f0c8b1e-…"
            spellCheck={false}
          />
        </Field>

        <Field label="Xato kodi" hint="Masalan seller_not_found.">
          <Input
            value={draft.error_code}
            onChange={(event) => set("error_code", event.target.value)}
            spellCheck={false}
          />
        </Field>

        <Field label="Boshlanishi" hint="Vaqt UTC bo'yicha o'qiladi.">
          <Input
            type="datetime-local"
            value={draft.date_from}
            onChange={(event) => set("date_from", event.target.value)}
          />
        </Field>

        <Field label="Tugashi" hint="Vaqt UTC bo'yicha o'qiladi.">
          <Input
            type="datetime-local"
            value={draft.date_to}
            onChange={(event) => set("date_to", event.target.value)}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-4">
          <Button type="submit" disabled={logs.isFetching}>
            Filtrlash
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(EMPTY);
              setApplied(EMPTY);
              setPage(1);
            }}
          >
            Tozalash
          </Button>
          <label className="ml-auto flex items-center gap-2">
            <span className="type-label text-muted-foreground">Sahifada</span>
            <Select
              value={String(size)}
              onChange={(event) => {
                setSize(Number(event.target.value));
                setPage(1);
              }}
              className="w-24"
            >
              {[25, 50, 100, 200].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </form>

      <p className="type-caption border-b border-border bg-muted/40 px-5 py-3">
        Muvaffaqiyatli o'qishlar tanlab yoziladi
        {sample !== undefined ? ` — hozirgi ulush ${Math.round(sample * 100)}%` : ""}; bu server
        sozlamasi. Shuning uchun bo'sh jadval «hech kim kirmadi» yoki «tizim yiqildi» degani emas —
        u faqat shu filtrga mos yozuv yo'qligini bildiradi. Xatoliklar esa har doim yoziladi.
      </p>

      {logs.isPending ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 8 }, (_, index) => (
            <LineSkeleton key={index} className="h-6 w-full" />
          ))}
        </div>
      ) : logs.isError ? (
        <div className="p-5">
          <ErrorState error={logs.error} onRetry={() => void logs.refetch()} compact />
        </div>
      ) : (
        <>
          <DataTable
            head={["Vaqt", "Metod", "Yo'l", "Javob", "Davomiyligi", "Xato", "Aktor", ""]}
            empty={<p className="type-caption">Bu filtrga mos yozuv topilmadi.</p>}
          >
            {logs.data.items.map((row) => (
              <Row key={row.id}>
                <Cell className="whitespace-nowrap">{formatDateTime(row.occurred_at, lang)}</Cell>
                <Cell className="whitespace-nowrap font-mono text-xs">{row.method}</Cell>
                <Cell className="max-w-[22rem]">
                  <span className="block truncate font-mono text-xs" title={row.path}>
                    {row.path}
                  </span>
                </Cell>
                <Cell>
                  <Pill tone={statusTone(row.status_code)}>{row.status_code}</Pill>
                </Cell>
                <Cell numeric className="whitespace-nowrap">
                  {Math.round(row.duration_ms)} ms
                </Cell>
                <Cell className="whitespace-nowrap font-mono text-xs">{row.error_code ?? "—"}</Cell>
                <Cell className="whitespace-nowrap font-mono text-xs">
                  {row.actor_id ? row.actor_id.slice(0, 8) : "mehmon"}
                </Cell>
                <Cell>
                  <Button size="sm" variant="outline" onClick={() => setOpenId(row.id)}>
                    Tafsilot
                  </Button>
                </Cell>
              </Row>
            ))}
          </DataTable>

          <Pager
            page={logs.data.page}
            size={logs.data.size}
            total={logs.data.total}
            pages={logs.data.pages}
            busy={logs.isFetching}
            onChange={setPage}
          />
        </>
      )}

      <RequestLogDetailPanel logId={openId} lang={lang} onClose={() => setOpenId(null)} />
    </PanelSection>
  );
}

function RequestLogDetailPanel({
  logId,
  lang,
  onClose,
}: {
  logId: string | null;
  lang: "uz" | "ru";
  onClose: () => void;
}) {
  const detail = useRequestLogDetail(logId);

  return (
    <Panel open={logId !== null} title="So'rov tafsiloti" onClose={onClose}>
      {detail.isPending ? (
        <LineSkeleton className="h-40 w-full" />
      ) : detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} compact />
      ) : detail.data ? (
        <div className="space-y-4 text-sm">
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <Pair term="Vaqt" value={formatDateTime(detail.data.occurred_at, lang)} />
            <Pair term="Javob" value={String(detail.data.status_code)} />
            <Pair term="Metod" value={detail.data.method} />
            <Pair term="Davomiyligi" value={`${Math.round(detail.data.duration_ms)} ms`} />
            <Pair term="Yo'l" value={detail.data.path} mono />
            <Pair term="Marshrut" value={detail.data.route ?? "—"} mono />
            <Pair term="So'rov qatori" value={detail.data.query ?? "—"} mono />
            <Pair term="Aktor" value={detail.data.actor_id ?? "mehmon"} mono />
            <Pair term="IP" value={detail.data.ip_address ?? "—"} mono />
            <Pair term="Request ID" value={detail.data.request_id ?? "—"} mono />
            <Pair term="Xato kodi" value={detail.data.error_code ?? "—"} mono />
          </dl>

          {detail.data.user_agent && (
            <section>
              <h4 className="type-label mb-1.5 text-muted-foreground">Brauzer</h4>
              <p className="break-all font-mono text-xs">{detail.data.user_agent}</p>
            </section>
          )}

          {detail.data.error_message && (
            <section>
              <h4 className="type-label mb-1.5 text-muted-foreground">Xato matni</h4>
              <p className="border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                {detail.data.error_message}
              </p>
            </section>
          )}

          <section>
            <h4 className="type-label mb-1.5 text-muted-foreground">Traceback</h4>
            {detail.data.traceback ? (
              <pre className="max-h-80 overflow-auto border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                {detail.data.traceback}
              </pre>
            ) : (
              <p className="type-caption">
                Bu so'rov uchun traceback yo'q — u xatolik bilan tugamagan.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </Panel>
  );
}

function Pair({ term, value, mono = false }: { term: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="type-label text-muted-foreground">{term}</dt>
      <dd className={mono ? "mt-0.5 break-all font-mono text-xs" : "mt-0.5"}>{value}</dd>
    </div>
  );
}
