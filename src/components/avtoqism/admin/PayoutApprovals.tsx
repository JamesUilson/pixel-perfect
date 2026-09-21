/**
 * To'lovlarni tasdiqlash — the decision queue for money leaving the platform.
 *
 * Two things this screen must not get wrong.
 *
 * The first is the destination. AVTOQISM never holds a card number: what is
 * stored is the provider's token plus enough to recognise the card, and the
 * server sends only the masked display. So the UI shows that display and says
 * where it comes from, rather than a field that looks like it was truncated for
 * the table and could be expanded.
 *
 * The second is what a click costs. Approving books the transfer and marks the
 * request paid; rejecting hands the hold back to the seller's available
 * balance. Both are idempotent on the server — a second click on a decided
 * payout returns the same row untouched — and both say so here, because an
 * operator who is unsure whether the first click landed is an operator who
 * refreshes and clicks again.
 */
import { useState } from "react";
import { ShieldAlert } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { num } from "@/components/avtoqism/panel/Charts";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import { Button, Cell, DataTable, Pill, Row, Select } from "@/components/avtoqism/panel/Widgets";
import { formatDateTime, formatSom } from "@/lib/format";
import {
  useApprovePayout,
  usePayoutQueue,
  useRejectPayout,
  type PayoutRequestOut,
} from "@/lib/query/admin";
import { ReasonDialog } from "./ReasonDialog";

type Tone = "neutral" | "good" | "warning" | "critical" | "info";

const STATUS_UZ: Record<string, { label: string; tone: Tone }> = {
  REQUESTED: { label: "So'ralgan", tone: "warning" },
  APPROVED: { label: "Tasdiqlangan", tone: "info" },
  PROCESSING: { label: "Jarayonda", tone: "info" },
  PAID: { label: "To'langan", tone: "good" },
  REJECTED: { label: "Rad etilgan", tone: "critical" },
  FAILED: { label: "Xatolik", tone: "critical" },
};

const FILTERS: { value: string | null; label: string }[] = [
  { value: "REQUESTED", label: "So'ralgan" },
  { value: "APPROVED", label: "Tasdiqlangan" },
  { value: "PROCESSING", label: "Jarayonda" },
  { value: "PAID", label: "To'langan" },
  { value: "REJECTED", label: "Rad etilgan" },
  { value: null, label: "Hammasi" },
];

/** A decided payout has nothing left to decide; the server refuses either way. */
const DECIDABLE = new Set(["REQUESTED", "APPROVED", "PROCESSING"]);

export function PayoutApprovals({ lang }: { lang: "uz" | "ru" }) {
  const [status, setStatus] = useState<string | null>("REQUESTED");
  const [approving, setApproving] = useState<PayoutRequestOut | null>(null);
  const [rejecting, setRejecting] = useState<PayoutRequestOut | null>(null);

  const queue = usePayoutQueue({ status });
  const approve = useApprovePayout();
  const reject = useRejectPayout();

  return (
    <PanelSection
      title="To'lov so'rovlarini tasdiqlash"
      subtitle="Sotuvchi yechmoqchi bo'lgan pul, u ketadigan karta va qaror."
      action={
        <label className="flex items-center gap-2">
          <span className="type-label text-muted-foreground">Holat</span>
          <Select
            value={status ?? ""}
            onChange={(event) => setStatus(event.target.value === "" ? null : event.target.value)}
            className="w-44"
          >
            {FILTERS.map((option) => (
              <option key={option.label} value={option.value ?? ""}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      }
    >
      <div className="space-y-2 border-b border-border bg-muted/40 px-5 py-4 text-sm">
        <p>
          <span className="font-semibold">To'lash</span> — summa sotuvchining «mavjud» hisobidan
          chiqib, platformaning «to'lovlar» hisobiga yoziladi va so'rov «To'langan» bo'ladi. Buni
          faqat bank o'tkazmasi haqiqatan ham bajarilgandan keyin bosing.
        </p>
        <p>
          <span className="font-semibold">Rad etish</span> — ushlab turilgan summa sotuvchining
          mavjud balansiga qaytadi va u qaytadan so'rov yubora oladi.
        </p>
        <p className="type-caption">
          Ikkala amal ham takrorlashga chidamli: allaqachon hal qilingan so'rovga qayta bosilsa,
          daftarga ikkinchi yozuv tushmaydi — server o'sha qatorni o'zgarishsiz qaytaradi.
        </p>
      </div>

      {queue.isPending ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 5 }, (_, index) => (
            <LineSkeleton key={index} className="h-6 w-full" />
          ))}
        </div>
      ) : queue.isError ? (
        <div className="p-5">
          <ErrorState error={queue.error} onRetry={() => void queue.refetch()} compact />
        </div>
      ) : (
        <DataTable
          head={["Raqam", "Do'kon", "So'ralgan", "Summa", "Qayerga", "Holat", "Amal"]}
          empty={
            <p className="type-caption">
              {status === "REQUESTED"
                ? "Qaror kutayotgan to'lov so'rovi yo'q."
                : "Bu holatda to'lov so'rovi yo'q."}
            </p>
          }
        >
          {queue.data.map((payout) => {
            const state = STATUS_UZ[payout.status] ?? {
              label: payout.status,
              tone: "neutral" as const,
            };
            const busy =
              (approve.isPending && approve.variables?.payoutId === payout.id) ||
              (reject.isPending && reject.variables?.payoutId === payout.id);
            return (
              <Row key={payout.id}>
                <Cell className="whitespace-nowrap font-semibold">{payout.reference}</Cell>
                <Cell className="whitespace-nowrap">{payout.store_name}</Cell>
                <Cell className="whitespace-nowrap">{formatDateTime(payout.created_at, lang)}</Cell>
                <Cell numeric className="whitespace-nowrap">
                  {formatSom(num(payout.amount))}
                </Cell>
                <Cell>
                  <Destination payout={payout} />
                </Cell>
                <Cell>
                  <Pill tone={state.tone}>{state.label}</Pill>
                  {payout.failure_reason && (
                    <span className="type-caption mt-1 block max-w-[16rem]">
                      {payout.failure_reason}
                    </span>
                  )}
                </Cell>
                <Cell>
                  {DECIDABLE.has(payout.status) ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          approve.reset();
                          setApproving(payout);
                        }}
                      >
                        {busy ? "…" : "To'lash"}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => {
                          reject.reset();
                          setRejecting(payout);
                        }}
                      >
                        Rad etish
                      </Button>
                    </div>
                  ) : (
                    <span className="type-caption">
                      {payout.paid_at
                        ? formatDateTime(payout.paid_at, lang)
                        : payout.reviewed_at
                          ? formatDateTime(payout.reviewed_at, lang)
                          : "—"}
                    </span>
                  )}
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      )}

      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Karta raqami tizimda saqlanmaydi. Bu ustunda faqat bank nomi, turi va oxirgi to'rt raqam
        ko'rsatiladi — to'liq raqamni bu yerdan ham, boshqa hech qaysi ekrandan ham ochib bo'lmaydi.
      </p>

      {approving && (
        <ReasonDialog
          open
          title="To'lovni amalga oshirish"
          confirmLabel="To'landi deb belgilash"
          reasonLabel="Izoh"
          reasonHint="Ixtiyoriy: bank ma'lumotnomasi yoki partiya raqami."
          placeholder="Kapitalbank o'tkazmasi №4417"
          consequence="Summa sotuvchining mavjud balansidan chiqariladi va so'rov «To'langan» holatiga o'tadi. Takroriy bosish daftarga ikkinchi yozuv qo'shmaydi."
          subject={
            <>
              <span className="font-semibold">
                {approving.reference} · {formatSom(num(approving.amount))}
              </span>
              <span className="type-caption block">
                {approving.store_name} → {destinationText(approving)}
              </span>
            </>
          }
          pending={approve.isPending}
          error={approve.isError ? approve.error.message : null}
          onConfirm={(note) =>
            approve.mutate(
              { payoutId: approving.id, note: note === "" ? undefined : note },
              { onSuccess: () => setApproving(null) },
            )
          }
          onClose={() => setApproving(null)}
        />
      )}

      {rejecting && (
        <ReasonDialog
          open
          danger
          required
          title="To'lovni rad etish"
          confirmLabel="Rad etish"
          reasonHint="Kamida 3 belgi. Sotuvchi shu matnni o'qiydi."
          placeholder="Karta tasdiqlanmagan"
          consequence="Ushlab turilgan summa sotuvchining mavjud balansiga qaytariladi va u qaytadan so'rov yubora oladi. Takroriy bosish pulni ikki marta qaytarmaydi."
          subject={
            <>
              <span className="font-semibold">
                {rejecting.reference} · {formatSom(num(rejecting.amount))}
              </span>
              <span className="type-caption block">{rejecting.store_name}</span>
            </>
          }
          pending={reject.isPending}
          error={reject.isError ? reject.error.message : null}
          onConfirm={(reason) =>
            reject.mutate(
              { payoutId: rejecting.id, reason },
              { onSuccess: () => setRejecting(null) },
            )
          }
          onClose={() => setRejecting(null)}
        />
      )}
    </PanelSection>
  );
}

/**
 * `account_label` is the destination frozen onto the payout when it was
 * requested; `destination` is the saved card as it stands now. Both are masked
 * by the server, and the frozen one is what the money actually followed, so it
 * is the fallback rather than the other way round.
 */
function destinationText(payout: PayoutRequestOut): string {
  return payout.destination?.display ?? payout.account_label ?? "belgilanmagan";
}

function Destination({ payout }: { payout: PayoutRequestOut }) {
  return (
    <div className="min-w-0">
      <span className="block whitespace-nowrap text-sm font-medium">{destinationText(payout)}</span>
      {payout.destination_verified ? (
        <span className="type-caption block">SMS bilan tasdiqlangan karta</span>
      ) : (
        <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-destructive">
          <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
          Tasdiqlanmagan yo'nalish — o'tkazmadan oldin tekshiring
        </span>
      )}
    </div>
  );
}
