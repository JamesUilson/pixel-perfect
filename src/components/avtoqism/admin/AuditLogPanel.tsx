/**
 * Audit jurnali — who did what to which record.
 *
 * Read side by side with the request log when something went wrong: that one
 * says a call happened, this one says what it changed. So the before and after
 * payloads are the point of the screen, not an afterthought — they are shown as
 * formatted JSON in a detail view rather than squeezed into a cell, because a
 * truncated diff is worse than no diff.
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
  Row,
} from "@/components/avtoqism/panel/Widgets";
import { formatDateTime } from "@/lib/format";
import { useAuditLogs, type AuditLogFilters, type AuditLogRow } from "@/lib/query/admin";
import { Pager } from "./Pager";

type Draft = {
  action: string;
  entity_type: string;
  entity_id: string;
  actor_id: string;
  date_from: string;
  date_to: string;
};

const EMPTY: Draft = {
  action: "",
  entity_type: "",
  entity_id: "",
  actor_id: "",
  date_from: "",
  date_to: "",
};

function toFilters(draft: Draft, page: number, size: number): AuditLogFilters {
  return {
    action: draft.action.trim() || null,
    entity_type: draft.entity_type.trim() || null,
    entity_id: draft.entity_id.trim() || null,
    actor_id: draft.actor_id.trim() || null,
    date_from: draft.date_from || null,
    date_to: draft.date_to || null,
    page,
    size,
  };
}

export function AuditLogPanel({ lang }: { lang: "uz" | "ru" }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [applied, setApplied] = useState<Draft>(EMPTY);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditLogRow | null>(null);

  const logs = useAuditLogs(toFilters(applied, page, 50));

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <PanelSection
      title="Audit jurnali"
      subtitle="Kim, qachon, qaysi yozuvni o'zgartirdi — va nimadan nimaga."
    >
      <form
        className="grid gap-4 border-b border-border p-5 sm:grid-cols-2 xl:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setApplied(draft);
        }}
      >
        <Field label="Amal" hint="Boshlanishi bo'yicha: seller, payout.transition …">
          <Input
            value={draft.action}
            onChange={(event) => set("action", event.target.value)}
            placeholder="seller."
            spellCheck={false}
          />
        </Field>
        <Field label="Obyekt turi" hint="To'liq mos kelishi kerak: seller, payout, receipt …">
          <Input
            value={draft.entity_type}
            onChange={(event) => set("entity_type", event.target.value)}
            placeholder="seller"
            spellCheck={false}
          />
        </Field>
        <Field label="Obyekt ID">
          <Input
            value={draft.entity_id}
            onChange={(event) => set("entity_id", event.target.value)}
            placeholder="3f0c8b1e-…"
            spellCheck={false}
          />
        </Field>
        <Field label="Aktor ID">
          <Input
            value={draft.actor_id}
            onChange={(event) => set("actor_id", event.target.value)}
            placeholder="3f0c8b1e-…"
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

        <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-3">
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
        </div>
      </form>

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
            head={["Vaqt", "Amal", "Obyekt", "Aktor", "Rollar", "IP", ""]}
            empty={<p className="type-caption">Bu filtrga mos audit yozuvi topilmadi.</p>}
          >
            {logs.data.items.map((row) => (
              <Row key={row.id}>
                <Cell className="whitespace-nowrap">{formatDateTime(row.created_at, lang)}</Cell>
                <Cell className="whitespace-nowrap font-mono text-xs">{row.action}</Cell>
                <Cell className="whitespace-nowrap">
                  {row.entity_type}
                  <span className="type-caption block font-mono">
                    {row.entity_id ? row.entity_id.slice(0, 8) : "—"}
                  </span>
                </Cell>
                <Cell className="whitespace-nowrap font-mono text-xs">
                  {row.actor_id ? row.actor_id.slice(0, 8) : "tizim"}
                </Cell>
                <Cell className="max-w-[12rem]">
                  <span className="block truncate text-xs" title={row.actor_roles ?? ""}>
                    {row.actor_roles ?? "—"}
                  </span>
                </Cell>
                <Cell className="whitespace-nowrap font-mono text-xs">{row.ip_address ?? "—"}</Cell>
                <Cell>
                  <Button size="sm" variant="outline" onClick={() => setOpen(row)}>
                    O'zgarish
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

      <Panel open={open !== null} title="O'zgarish tafsiloti" onClose={() => setOpen(null)}>
        {open && (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              <Pair term="Vaqt" value={formatDateTime(open.created_at, lang)} />
              <Pair term="Amal" value={open.action} mono />
              <Pair
                term="Obyekt"
                value={`${open.entity_type} ${open.entity_id ?? ""}`.trim()}
                mono
              />
              <Pair term="Aktor" value={open.actor_id ?? "tizim"} mono />
              <Pair term="Rollar" value={open.actor_roles ?? "—"} />
              <Pair term="IP" value={open.ip_address ?? "—"} mono />
            </dl>

            <JsonBlock
              title="Oldin"
              payload={open.before}
              empty="Yangi yozuv — oldingi holat yo'q."
            />
            <JsonBlock
              title="Keyin"
              payload={open.after}
              empty="O'chirilgan — keyingi holat yo'q."
            />
          </div>
        )}
      </Panel>
    </PanelSection>
  );
}

function JsonBlock({
  title,
  payload,
  empty,
}: {
  title: string;
  payload: Record<string, unknown> | null;
  empty: string;
}) {
  return (
    <section>
      <h4 className="type-label mb-1.5 text-muted-foreground">{title}</h4>
      {payload === null || Object.keys(payload).length === 0 ? (
        <p className="type-caption">{empty}</p>
      ) : (
        <pre className="max-h-64 overflow-auto border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </section>
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
