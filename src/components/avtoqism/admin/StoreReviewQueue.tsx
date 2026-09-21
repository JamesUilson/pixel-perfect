/**
 * Do'kon ko'rib chiqish — the queue that decides whether a shop may sell.
 *
 * A store's status is the only thing between a filled-in form and parts that
 * appear beside everyone else's, so the evidence travels with the row: the
 * owner and their phone, where the shop is, what level of verification was
 * asked for, and the papers that were uploaded. A reviewer who has to open four
 * screens per store starts rubber-stamping, which is the failure this layout
 * exists to prevent.
 *
 * Suspension is spelled out rather than implied. It is not a label: the moment
 * a store is suspended the catalogue stops returning its offers, so the shop
 * stops selling that second.
 */
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import { Button, Cell, DataTable, Panel, Pill, Row } from "@/components/avtoqism/panel/Widgets";
import { formatDateTime, formatPhone, groupDigits } from "@/lib/format";
import {
  useDecideStore,
  useStoreDossier,
  useStoreQueue,
  type StoreMove,
  type StoreReviewOut,
} from "@/lib/query/admin";
import { PrivateDocumentLink } from "./PrivateDocumentLink";
import { ReasonDialog } from "./ReasonDialog";

type Tone = "neutral" | "good" | "warning" | "critical" | "info";

const STATUS_UZ: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Ko'rib chiqilmoqda", tone: "warning" },
  ACTIVE: { label: "Faol", tone: "good" },
  SUSPENDED: { label: "To'xtatilgan", tone: "critical" },
  REJECTED: { label: "Rad etilgan", tone: "critical" },
};

const LEVEL_UZ: Record<string, string> = {
  BASIC: "Oddiy",
  BUSINESS_VERIFIED: "Biznes tasdiqlangan",
  TRUSTED_SELLER: "Ishonchli sotuvchi",
};

const FILTERS: { value: string | null; label: string }[] = [
  { value: "PENDING", label: "Ko'rib chiqilmoqda" },
  { value: "ACTIVE", label: "Faol" },
  { value: "SUSPENDED", label: "To'xtatilgan" },
  { value: "REJECTED", label: "Rad etilgan" },
  { value: null, label: "Hammasi" },
];

/** What each move does, in the words the reviewer needs before committing. */
const MOVES: Record<
  StoreMove,
  {
    label: string;
    title: string;
    consequence: string;
    required: boolean;
    danger: boolean;
    hint: string;
    /** Which statuses the server accepts this move from. */
    from: string[];
  }
> = {
  approve: {
    label: "Tasdiqlash",
    title: "Do'konni tasdiqlash",
    consequence:
      "Do'kon faol bo'ladi va uning takliflari shu zahoti qidiruvda hamda mahsulot sahifalarida ko'rina boshlaydi. Oldingi sabab o'chiriladi.",
    required: false,
    danger: false,
    hint: "Ixtiyoriy: do'kon egasi ko'radigan izoh.",
    from: ["PENDING", "REJECTED"],
  },
  reject: {
    label: "Rad etish",
    title: "Do'konni rad etish",
    consequence:
      "Do'kon rad etilgan holatga o'tadi va sota olmaydi. Sabab do'kon egasiga ko'rsatiladi — hujjatlarni to'g'irlab qayta topshirishi uchun aniq yozing.",
    required: true,
    danger: true,
    hint: "Kamida 3 belgi. Do'kon egasi shu matnni o'qiydi.",
    from: ["PENDING"],
  },
  suspend: {
    label: "To'xtatish",
    title: "Do'konni to'xtatish",
    consequence:
      "Do'kon shu zahoti sotishni to'xtatadi: uning barcha takliflari qidiruvdan va mahsulot sahifalaridan chiqariladi. Allaqachon berilgan buyurtmalar bekor qilinmaydi.",
    required: true,
    danger: true,
    hint: "Kamida 3 belgi. Do'kon egasi shu matnni o'qiydi.",
    from: ["ACTIVE"],
  },
  reinstate: {
    label: "Tiklash",
    title: "Do'konni tiklash",
    consequence:
      "Do'kon yana faol bo'ladi va takliflari vitrinaga qaytadi. Oldingi to'xtatish sababi o'chiriladi.",
    required: false,
    danger: false,
    hint: "Ixtiyoriy: do'kon egasi ko'radigan izoh.",
    from: ["SUSPENDED"],
  },
};

const MOVE_ORDER: StoreMove[] = ["approve", "reject", "suspend", "reinstate"];

function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : "—";
}

export function StoreReviewQueue({ lang }: { lang: "uz" | "ru" }) {
  const [filter, setFilter] = useState<string | null>("PENDING");
  const [openId, setOpenId] = useState<string | null>(null);
  const [move, setMove] = useState<StoreMove | null>(null);

  const queue = useStoreQueue(filter);
  const dossier = useStoreDossier(openId);
  const decide = useDecideStore();

  // The list row is enough to open the dialog on; the dossier query then
  // refreshes it. Falling back keeps the dialog from flashing empty.
  const listRow = useMemo(
    () => (queue.data ?? []).find((store) => store.id === openId) ?? null,
    [queue.data, openId],
  );
  const store = dossier.data ?? listRow;

  function close() {
    setOpenId(null);
    setMove(null);
    decide.reset();
  }

  function confirm(reason: string) {
    if (!store || !move) return;
    decide.mutate(
      { sellerId: store.id, move, reason: reason === "" ? undefined : reason },
      { onSuccess: () => setMove(null) },
    );
  }

  const active = move ? MOVES[move] : null;

  return (
    <PanelSection
      title="Do'konlarni ko'rib chiqish"
      subtitle="Ro'yxatdan o'tgan do'konlar, ularning hujjatlari va holat bo'yicha qarorlar."
      action={
        <div
          className="inline-flex flex-wrap border border-border bg-card"
          role="group"
          aria-label="Holat"
        >
          {FILTERS.map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={
                filter === option.value
                  ? "bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  : "px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      <p className="border-b border-warning/40 bg-warning/10 px-5 py-3 text-sm">
        To'xtatilgan do'kon sotishni to'xtatadi — uning takliflari o'sha zahoti qidiruvdan va
        mahsulot sahifalaridan chiqariladi. Tasdiqlash va tiklash esa do'konni darhol vitrinaga
        qaytaradi.
      </p>

      {queue.isPending ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }, (_, index) => (
            <LineSkeleton key={index} className="h-6 w-full" />
          ))}
        </div>
      ) : queue.isError ? (
        <div className="p-5">
          <ErrorState error={queue.error} onRetry={() => void queue.refetch()} compact />
        </div>
      ) : (
        <DataTable
          head={["Do'kon", "Egasi", "Hudud", "Holat", "Takliflar", "Oxirgi qaror", ""]}
          empty={
            <p className="type-caption">
              {filter === "PENDING"
                ? "Ko'rib chiqishni kutayotgan do'kon yo'q."
                : "Bu holatda do'kon yo'q."}
            </p>
          }
        >
          {queue.data.map((row) => (
            <StoreRow key={row.id} store={row} lang={lang} onOpen={() => setOpenId(row.id)} />
          ))}
        </DataTable>
      )}

      {/* The dossier steps aside while a decision is being confirmed, rather
          than stacking a second full-screen overlay on top of itself. */}
      <Panel
        open={openId !== null && move === null}
        title={store?.store_name ?? "Do'kon"}
        onClose={close}
      >
        {store ? (
          <Dossier
            store={store}
            lang={lang}
            stale={dossier.isFetching}
            error={decide.isError ? decide.error.message : null}
            onMove={(next) => {
              decide.reset();
              setMove(next);
            }}
          />
        ) : (
          <LineSkeleton className="h-40 w-full" />
        )}
      </Panel>

      {active && store && (
        <ReasonDialog
          open
          title={active.title}
          danger={active.danger}
          required={active.required}
          confirmLabel={active.label}
          consequence={active.consequence}
          reasonHint={active.hint}
          subject={
            <>
              <span className="font-semibold">{store.store_name}</span>
              <span className="type-caption block">
                {store.region}, {store.district} · {store.owner_name ?? "egasi noma'lum"}
              </span>
            </>
          }
          pending={decide.isPending}
          error={decide.isError ? decide.error.message : null}
          onConfirm={confirm}
          onClose={() => setMove(null)}
        />
      )}
    </PanelSection>
  );
}

function StoreRow({
  store,
  lang,
  onOpen,
}: {
  store: StoreReviewOut;
  lang: "uz" | "ru";
  onOpen: () => void;
}) {
  const status = STATUS_UZ[store.status] ?? { label: store.status, tone: "neutral" as const };
  return (
    <Row>
      <Cell>
        <span className="font-semibold">{store.store_name}</span>
        <span className="type-caption block">{store.slug}</span>
      </Cell>
      <Cell className="whitespace-nowrap">
        {store.owner_name ?? "—"}
        <span className="type-caption block">
          {formatPhone(store.owner_phone) || store.owner_phone || "telefon yo'q"}
        </span>
      </Cell>
      <Cell className="whitespace-nowrap">
        {store.region}
        <span className="type-caption block">{store.district}</span>
      </Cell>
      <Cell>
        <Pill tone={status.tone}>{status.label}</Pill>
        <span className="type-caption mt-1 block">
          {LEVEL_UZ[store.verification_level] ?? store.verification_level}
        </span>
      </Cell>
      <Cell numeric>{groupDigits(store.active_offer_count)}</Cell>
      <Cell className="max-w-[18rem]">
        {store.status_changed_at ? (
          <>
            <span className="type-caption block">
              {formatDateTime(store.status_changed_at, lang)} · {shortId(store.status_changed_by)}
            </span>
            <span className="block text-sm">{store.status_reason ?? "sababsiz"}</span>
          </>
        ) : (
          <span className="type-caption">Hali qaror qabul qilinmagan</span>
        )}
      </Cell>
      <Cell>
        <Button size="sm" variant="outline" onClick={onOpen}>
          Ko'rib chiqish
        </Button>
      </Cell>
    </Row>
  );
}

function Dossier({
  store,
  lang,
  stale,
  error,
  onMove,
}: {
  store: StoreReviewOut;
  lang: "uz" | "ru";
  stale: boolean;
  error: string | null;
  onMove: (move: StoreMove) => void;
}) {
  const status = STATUS_UZ[store.status] ?? { label: store.status, tone: "neutral" as const };
  const available = MOVE_ORDER.filter((move) => MOVES[move].from.includes(store.status));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={status.tone}>{status.label}</Pill>
        <Pill tone="neutral">{LEVEL_UZ[store.verification_level] ?? store.verification_level}</Pill>
        {stale && <span className="type-caption">yangilanmoqda…</span>}
      </div>

      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <Line term="Egasi" value={store.owner_name ?? "—"} />
        <Line
          term="Egasining telefoni"
          value={formatPhone(store.owner_phone) || store.owner_phone || "—"}
        />
        <Line term="Do'kon telefoni" value={formatPhone(store.phone) || store.phone || "—"} />
        <Line term="Hudud" value={`${store.region}, ${store.district}`} />
        <Line term="Manzil" value={store.address ?? "—"} />
        <Line term="Ro'yxatdan o'tgan" value={formatDateTime(store.created_at, lang)} />
        <Line term="Faol takliflar" value={groupDigits(store.active_offer_count)} />
      </dl>

      <section>
        <h4 className="type-label mb-2 text-muted-foreground">Oxirgi qaror</h4>
        {store.status_changed_at ? (
          <p className="border border-border bg-muted/40 px-4 py-3 text-sm">
            {store.status_reason ?? "Sabab yozilmagan."}
            <span className="type-caption mt-1 block">
              {formatDateTime(store.status_changed_at, lang)} · kim:{" "}
              {shortId(store.status_changed_by)}
            </span>
          </p>
        ) : (
          <p className="type-caption">Bu do'kon bo'yicha hali qaror qabul qilinmagan.</p>
        )}
      </section>

      <section>
        <h4 className="type-label mb-2 text-muted-foreground">Tasdiqlash dalillari</h4>
        {store.verifications.length === 0 ? (
          <p className="type-caption">Do'kon tasdiqlash uchun ariza topshirmagan.</p>
        ) : (
          <ul className="space-y-2">
            {store.verifications.map((evidence) => (
              <li key={evidence.id} className="border border-border bg-card px-4 py-3 text-sm">
                <p className="font-semibold">
                  {LEVEL_UZ[evidence.requested_level] ?? evidence.requested_level}
                </p>
                <p className="type-caption mt-1">
                  {evidence.legal_name ?? "Yuridik nom ko'rsatilmagan"}
                  {evidence.registration_number ? ` · STIR ${evidence.registration_number}` : ""}
                </p>
                <p className="type-caption mt-1">
                  Topshirilgan: {formatDateTime(evidence.created_at, lang)}
                  {evidence.reviewed_at
                    ? ` · ko'rilgan: ${formatDateTime(evidence.reviewed_at, lang)}`
                    : " · hali ko'rilmagan"}
                </p>
                {evidence.approved !== null && (
                  <span className="mt-2 inline-block">
                    <Pill tone={evidence.approved ? "good" : "critical"}>
                      {evidence.approved ? "Qabul qilingan" : "Rad etilgan"}
                    </Pill>
                  </span>
                )}
                {evidence.reviewer_note && <p className="mt-2 text-sm">{evidence.reviewer_note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="type-label mb-2 text-muted-foreground">Topshirilgan hujjatlar</h4>
        {store.documents.length === 0 ? (
          <p className="type-caption">Hujjat yuklanmagan.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {store.documents.map((document) => (
                <PrivateDocumentLink key={document.id} document={document} lang={lang} />
              ))}
            </ul>
            <p className="type-caption mt-2">
              Hujjatlar yopiq saqlanadi: manzil har safar server tekshiruvidan o'tib beriladi va
              havola ro'yxat bilan birga tarqalmaydi.
            </p>
          </>
        )}
      </section>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {available.length === 0 ? (
          <p className="type-caption">
            «{status.label}» holatidagi do'kon uchun bajariladigan amal yo'q.
          </p>
        ) : (
          available.map((move) => (
            <Button
              key={move}
              size="sm"
              variant={MOVES[move].danger ? "danger" : "primary"}
              onClick={() => onMove(move)}
            >
              {MOVES[move].label}
            </Button>
          ))
        )}
      </div>
    </div>
  );
}

function Line({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="type-label text-muted-foreground">{term}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
