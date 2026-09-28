/**
 * Moliya — the seller's money, explained before it is listed.
 *
 * Marketplace money is confusing for a reason: the buyer pays before the seller
 * ships, so for a while the money exists but belongs to nobody. That is escrow,
 * and it is the single thing a seller most often misreads as "the platform is
 * holding my money". So the screen opens with the four figures, then says in
 * four plain sentences how a som travels from the buyer to this bank account,
 * and only then shows the charts, the payouts and the ledger that prove it.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import {
  ChartCard,
  RevenueArea,
  StackedBars,
  StatTile,
  num,
} from "@/components/avtoqism/panel/Charts";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import {
  CardEntry,
  EMPTY_CARD_DRAFT,
  cardDraftIsValid,
  type CardDraft,
} from "@/components/avtoqism/payment/CardEntry";
import { cardDigits, expiryLabel } from "@/components/avtoqism/payment/card-brand";
import { useSellerId } from "@/components/avtoqism/panel/SellerContext";
import {
  Button,
  Cell,
  DataTable,
  ExportButton,
  Field,
  Input,
  Panel,
  Pill,
  RangePicker,
  Row,
  Select,
} from "@/components/avtoqism/panel/Widgets";
import { formatDate, formatDateTime, formatSom, groupDigits } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { PayoutMethodOut } from "@/lib/api/types";
import {
  useAddCard,
  useBalance,
  useLedger,
  useMakeDefaultCard,
  usePayoutMethods,
  usePayouts,
  useRequestPayout,
  useResendCardCode,
  useRevokeCard,
  useSellerMoneyFlow,
  useVerifyCard,
} from "@/lib/query/seller";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/finance")({
  head: () => ({
    meta: [{ title: "Moliya — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: SellerFinance,
});

/** The floor the payout service enforces; repeated here so the form can say so. */
const MIN_PAYOUT = 50_000;

const PAYOUT_STATUS_UZ: Record<
  string,
  { label: string; tone: "neutral" | "good" | "warning" | "critical" | "info" }
> = {
  REQUESTED: { label: "Kutilmoqda", tone: "warning" },
  APPROVED: { label: "Tasdiqlandi", tone: "info" },
  PROCESSING: { label: "Jarayonda", tone: "info" },
  PAID: { label: "To'langan", tone: "good" },
  REJECTED: { label: "Rad etildi", tone: "critical" },
  FAILED: { label: "Xatolik", tone: "critical" },
};

const METHOD_STATUS_UZ: Record<
  string,
  { label: string; tone: "neutral" | "good" | "warning" | "critical" | "info" }
> = {
  PENDING_VERIFICATION: { label: "Tasdiqlanmagan", tone: "warning" },
  VERIFIED: { label: "Tasdiqlangan", tone: "good" },
  REVOKED: { label: "O'chirilgan", tone: "neutral" },
  FAILED: { label: "Bloklangan", tone: "critical" },
};

const LEDGER_KIND_UZ: Record<string, string> = {
  ORDER_CAPTURE: "To'lov",
  COMMISSION: "Komissiya",
  SELLER_EARNING: "Daromad",
  EARNING_RELEASE: "Ochildi",
  DELIVERY_FEE: "Yetkazish",
  REFUND: "Qaytarish",
  PAYOUT: "To'lov",
  AD_CHARGE: "Reklama",
  AD_TOPUP: "Reklama to'ldirish",
  ADJUSTMENT: "Tuzatish",
};

const LEDGER_ACCOUNT_UZ: Record<string, string> = {
  CUSTOMER: "Xaridor",
  ESCROW: "Escrow",
  SELLER_PENDING: "Kutilayotgan",
  SELLER_AVAILABLE: "Mavjud",
  PLATFORM_COMMISSION: "Komissiya",
  PLATFORM_DELIVERY: "Yetkazish",
  PLATFORM_ADS: "Reklama",
  PAYOUT: "To'lov",
  REFUND: "Qaytarish",
};

/* --- screen ------------------------------------------------------------------ */
function SellerFinance() {
  const sellerId = useSellerId();
  const { lang } = useLang();

  const balance = useBalance(sellerId);
  const [days, setDays] = useState(30);
  const moneyFlow = useSellerMoneyFlow(sellerId, days);
  const payouts = usePayouts(sellerId);

  const [payoutOpen, setPayoutOpen] = useState(false);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const methods = usePayoutMethods(sellerId);
  const payableMethods = (methods.data ?? []).filter((method) => method.is_payable);

  const withdrawable = balance.data
    ? Math.max(num(balance.data.available) - num(balance.data.reserved), 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* --- balance --- */}
      {balance.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="border border-border bg-card p-5">
              <LineSkeleton className="mb-4 h-3 w-24" />
              <LineSkeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
      ) : balance.isError ? (
        <ErrorState error={balance.error} onRetry={() => void balance.refetch()} compact />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Yechish mumkin"
              value={formatSom(withdrawable)}
              hint="hoziroq so'rash mumkin"
            />
            <StatTile
              label="Kutilmoqda"
              value={formatSom(num(balance.data.pending))}
              hint="yetkazilgach ochiladi"
            />
            <StatTile
              label="Band qilingan"
              value={formatSom(num(balance.data.reserved))}
              hint="so'ralgan to'lovlar uchun"
            />
            <StatTile label="Jami ishlangan" value={formatSom(num(balance.data.lifetime_earned))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile
              label="To'langan komissiya"
              value={formatSom(num(balance.data.lifetime_commission))}
              deltaGoodWhenUp={false}
            />
            <StatTile
              label="Yechib olingan"
              value={formatSom(num(balance.data.lifetime_paid_out))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setPayoutOpen(true)} disabled={withdrawable < MIN_PAYOUT}>
              Pul yechish
            </Button>
            {withdrawable < MIN_PAYOUT && (
              <span className="type-caption">
                Eng kam summa {groupDigits(MIN_PAYOUT)} so'm — hozircha yetarli emas.
              </span>
            )}
          </div>
        </div>
      )}

      <MoneyExplainer />

      {/* --- money flow --- */}
      <MoneyFlowCard
        days={days}
        onDaysChange={setDays}
        rows={moneyFlow.data ?? null}
        isPending={moneyFlow.isPending}
        error={moneyFlow.isError ? moneyFlow.error : null}
        onRetry={() => void moneyFlow.refetch()}
      />

      {/* --- where the money lands --- */}
      <CardsSection
        sellerId={sellerId}
        methods={methods.data ?? null}
        isPending={methods.isPending}
        error={methods.isError ? methods.error : null}
        onRetry={() => void methods.refetch()}
        onAddCard={() => setAddCardOpen(true)}
      />

      {/* --- payouts --- */}
      <PanelSection
        title="Pul yechish so'rovlari"
        subtitle="Har bir so'rov qo'lda tekshiriladi va odatda bir ish kunida to'lanadi."
        action={<ExportButton path={`/export/seller/${sellerId}/payouts`} />}
      >
        {payouts.isPending ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }, (_, index) => (
              <LineSkeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : payouts.isError ? (
          <div className="p-5">
            <ErrorState error={payouts.error} onRetry={() => void payouts.refetch()} compact />
          </div>
        ) : (
          <DataTable
            head={["Raqam", "So'ralgan", "Summa", "Holat", "Hisob", "To'langan sana", "Izoh"]}
            empty={
              <p className="type-caption">
                Hali pul yechilmagan. Balans yetarli bo'lsa, yuqoridagi tugma orqali so'rang.
              </p>
            }
          >
            {payouts.data.map((payout) => {
              const status = PAYOUT_STATUS_UZ[payout.status] ?? {
                label: payout.status,
                tone: "neutral" as const,
              };
              return (
                <Row key={payout.id}>
                  <Cell className="whitespace-nowrap font-semibold">{payout.reference}</Cell>
                  <Cell className="whitespace-nowrap">{formatDate(payout.created_at, lang)}</Cell>
                  <Cell numeric className="whitespace-nowrap">
                    {formatSom(payout.amount)}
                  </Cell>
                  <Cell>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </Cell>
                  <Cell className="whitespace-nowrap">{payout.account_label ?? "—"}</Cell>
                  <Cell className="whitespace-nowrap">
                    {payout.paid_at ? formatDate(payout.paid_at, lang) : "—"}
                  </Cell>
                  <Cell>
                    <span className="type-caption block max-w-[16rem] truncate">
                      {payout.failure_reason ?? payout.note ?? "—"}
                    </span>
                  </Cell>
                </Row>
              );
            })}
          </DataTable>
        )}
      </PanelSection>

      <LedgerSection sellerId={sellerId} lang={lang} />

      <Panel open={payoutOpen} title="Pul yechish" onClose={() => setPayoutOpen(false)}>
        {payoutOpen && (
          <PayoutForm
            sellerId={sellerId}
            withdrawable={withdrawable}
            methods={payableMethods}
            onDone={() => setPayoutOpen(false)}
            onAddCard={() => {
              setPayoutOpen(false);
              setAddCardOpen(true);
            }}
          />
        )}
      </Panel>

      <Panel open={addCardOpen} title="Karta qo'shish" onClose={() => setAddCardOpen(false)}>
        {addCardOpen && <AddCardFlow sellerId={sellerId} onDone={() => setAddCardOpen(false)} />}
      </Panel>
    </div>
  );
}

/* --- explainer ------------------------------------------------------------------ */
function MoneyExplainer() {
  const steps = [
    {
      title: "Xaridor to'laydi",
      body: "Buyurtma berilganda pul xaridordan darrov yechiladi. Bu pul hali sizniki emas.",
    },
    {
      title: "Pul saqlanadi",
      body: "Buyurtma yetkazilgunicha pul AVTOQISMda xavfsiz turadi — na siz, na xaridor tega olmaydi.",
    },
    {
      title: "Yetkazilgach ochiladi",
      body: "Buyurtma yetkazilgani tasdiqlangach, sizga tegishli qism «yechish mumkin» summaga o'tadi.",
    },
    {
      title: "Komissiya olinadi",
      body: "Komissiya xaridor to'lagan summadan hisoblanadi va shu bosqichda ushlab qolinadi. Qolgani sizniki.",
    },
  ];
  return (
    <section className="border border-border bg-card p-5">
      <h3 className="type-h3">Pul qanday harakatlanadi</h3>
      <ol className="mt-4 grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="bg-card p-4">
            <span className="type-label text-primary">{index + 1}-qadam</span>
            <p className="mt-2 text-sm font-semibold">{step.title}</p>
            <p className="type-caption mt-1">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* --- money flow chart ------------------------------------------------------------ */
function MoneyFlowCard({
  days,
  onDaysChange,
  rows,
  isPending,
  error,
  onRetry,
}: {
  days: number;
  onDaysChange: (days: number) => void;
  rows: Record<string, unknown>[] | null;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const picker = <RangePicker value={days} onChange={onDaysChange} />;
  const series = [
    { key: "earnings", name: "Daromad" },
    { key: "commission", name: "Komissiya" },
    { key: "ads", name: "Reklama" },
    { key: "payouts", name: "Yechilgan" },
  ];

  // `ChartCard` feeds its child straight to a ResponsiveContainer, which only
  // accepts a chart element — so the three non-chart states get a plain frame.
  if (isPending || error || !rows || rows.length === 0) {
    return (
      <section className="border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h3 className="type-h3">Pul aylanmasi</h3>
          {picker}
        </div>
        {isPending ? (
          <LineSkeleton className="h-[260px] w-full" />
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} compact />
        ) : (
          <p className="type-caption py-12 text-center">Bu davr uchun ma'lumot yo'q.</p>
        )}
      </section>
    );
  }

  // Earnings and the deductions taken out of them share a currency but not an
  // order of magnitude, so they get a chart each rather than one where three
  // series lie flat along the axis.
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Daromad" action={picker}>
        <RevenueArea data={rows} valueKey="earnings" name="Daromad" />
      </ChartCard>
      <ChartCard title="Xarajatlar" subtitle="Komissiya, reklama va yechib olingan pul">
        <StackedBars data={rows} series={series.filter((s) => s.key !== "earnings")} />
      </ChartCard>
    </div>
  );
}

/* --- payout cards ------------------------------------------------------------------ */
/**
 * The cards the money can land on.
 *
 * A card is useless until it is verified, so the list says so on the card
 * itself rather than letting a seller discover it when a payout is refused.
 */
function CardsSection({
  sellerId,
  methods,
  isPending,
  error,
  onRetry,
  onAddCard,
}: {
  sellerId: string;
  methods: PayoutMethodOut[] | null;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  onAddCard: () => void;
}) {
  const makeDefault = useMakeDefaultCard(sellerId);
  const revoke = useRevokeCard(sellerId);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  return (
    <PanelSection
      title="Pul yechish kartalari"
      subtitle="Pul faqat shu yerdagi tasdiqlangan kartaga o'tkaziladi."
      action={
        <Button size="sm" onClick={onAddCard}>
          Karta qo'shish
        </Button>
      }
    >
      {isPending ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 2 }, (_, index) => (
            <LineSkeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="p-5">
          <ErrorState error={error} onRetry={onRetry} compact />
        </div>
      ) : !methods || methods.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <p className="type-caption">
            Hali karta qo'shilmagan. Pul yechish uchun avval karta qo'shing va uni SMS kod bilan
            tasdiqlang.
          </p>
          <div className="mt-4 flex justify-center">
            <Button onClick={onAddCard}>Karta qo'shish</Button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-px bg-border sm:grid-cols-2">
          {methods.map((method) => {
            const status = METHOD_STATUS_UZ[method.status] ?? {
              label: method.status,
              tone: "neutral" as const,
            };
            const expiry = expiryLabel(method.expires_month, method.expires_year);
            const defaultBusy = makeDefault.isPending && makeDefault.variables === method.id;
            const revokeBusy = revoke.isPending && revoke.variables === method.id;
            const defaultError =
              makeDefault.isError && makeDefault.variables === method.id
                ? makeDefault.error.message
                : null;
            const revokeError =
              revoke.isError && revoke.variables === method.id ? revoke.error.message : null;

            return (
              <li key={method.id} className="bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{method.display}</span>
                  <Pill tone={status.tone}>{status.label}</Pill>
                  {method.is_default && <Pill tone="info">Asosiy</Pill>}
                </div>
                <p className="type-caption mt-1">
                  {method.holder_name ?? "Egasi ko'rsatilmagan"}
                  {expiry ? ` · ${expiry}` : ""}
                </p>

                {verifyingId === method.id ? (
                  <div className="mt-3 border border-border p-3">
                    <CardCodeStep
                      sellerId={sellerId}
                      methodId={method.id}
                      initialDevCode={null}
                      onDone={() => setVerifyingId(null)}
                      onCancel={() => setVerifyingId(null)}
                    />
                  </div>
                ) : confirmingId === method.id ? (
                  <div className="mt-3 border border-destructive/40 bg-destructive/8 p-3">
                    <p className="text-sm">
                      Bu karta o'chiriladi va unga boshqa pul o'tkazilmaydi. Davom etamizmi?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        className="min-h-11"
                        disabled={revokeBusy}
                        onClick={() =>
                          revoke.mutate(method.id, { onSuccess: () => setConfirmingId(null) })
                        }
                      >
                        {revokeBusy ? "O'chirilmoqda…" : "Ha, o'chirilsin"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-11"
                        onClick={() => setConfirmingId(null)}
                      >
                        Bekor qilish
                      </Button>
                    </div>
                    {revokeError && <p className="mt-2 text-sm text-destructive">{revokeError}</p>}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!method.is_payable && method.status === "PENDING_VERIFICATION" && (
                      <Button
                        size="sm"
                        className="min-h-11"
                        onClick={() => setVerifyingId(method.id)}
                      >
                        Tasdiqlash
                      </Button>
                    )}
                    {method.is_payable && !method.is_default && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        disabled={defaultBusy}
                        onClick={() => makeDefault.mutate(method.id)}
                      >
                        {defaultBusy ? "Saqlanmoqda…" : "Asosiy qilish"}
                      </Button>
                    )}
                    {method.status !== "REVOKED" && (
                      <Button
                        size="sm"
                        variant="danger"
                        className="min-h-11"
                        onClick={() => setConfirmingId(method.id)}
                      >
                        O'chirish
                      </Button>
                    )}
                  </div>
                )}

                {defaultError && <p className="mt-2 text-sm text-destructive">{defaultError}</p>}
                {revokeError && confirmingId !== method.id && (
                  <p className="mt-2 text-sm text-destructive">{revokeError}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PanelSection>
  );
}

/* --- add a card ---------------------------------------------------------------------- */
/**
 * Two steps in one panel: the number, then the code.
 *
 * The number lives in state only until the request returns, and is cleared the
 * moment it does — it is never read back, never logged and never rendered
 * again. What comes back is an id and a masked card.
 */
function AddCardFlow({ sellerId, onDone }: { sellerId: string; onDone: () => void }) {
  const add = useAddCard(sellerId);

  const [draft, setDraft] = useState<CardDraft>(EMPTY_CARD_DRAFT);
  const [makeDefault, setMakeDefault] = useState(false);
  const [pendingMethodId, setPendingMethodId] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const valid = cardDraftIsValid(draft);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || add.isPending) return;
    add.mutate(
      {
        number: cardDigits(draft.number),
        expires_month: draft.month === "" ? null : Number(draft.month),
        expires_year: draft.year === "" ? null : Number(draft.year),
        holder_name: draft.holder.trim() === "" ? null : draft.holder.trim(),
        make_default: makeDefault,
      },
      {
        onSuccess: (result) => {
          setPendingMethodId(result.method.id);
          setDevCode(result.dev_code ?? null);
        },
        // Whether it worked or not, the number leaves this browser's memory.
        onSettled: () => setDraft((current) => ({ ...current, number: "" })),
      },
    );
  }

  if (pendingMethodId !== null) {
    return (
      <CardCodeStep
        sellerId={sellerId}
        methodId={pendingMethodId}
        initialDevCode={devCode}
        onDone={onDone}
        onCancel={onDone}
      />
    );
  }

  return (
    <form className="space-y-5" onSubmit={submit} aria-busy={add.isPending}>
      <CardEntry
        value={draft}
        onChange={setDraft}
        numberHint="Raqam to'g'ridan-to'g'ri to'lov provayderiga yuboriladi. AVTOQISMda faqat bank, turi va oxirgi to'rt raqam saqlanadi."
      />

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 border border-input accent-primary"
          checked={makeDefault}
          onChange={(event) => setMakeDefault(event.target.checked)}
        />
        Asosiy karta qilish
      </label>

      {add.isError && (
        <p role="alert" className="text-sm text-destructive">
          {add.error.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" className="min-h-11" disabled={!valid || add.isPending}>
          {add.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {add.isPending ? "Yuborilmoqda…" : "Davom etish"}
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" onClick={onDone}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}

/* --- the code step ------------------------------------------------------------------ */
function CardCodeStep({
  sellerId,
  methodId,
  initialDevCode,
  onDone,
  onCancel,
}: {
  sellerId: string;
  methodId: string;
  initialDevCode: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const verify = useVerifyCard(sellerId);
  const resend = useResendCardCode(sellerId);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(initialDevCode);

  const valid = code.length >= 4;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || verify.isPending) return;
    verify.mutate({ methodId, code }, { onSuccess: onDone });
  }

  return (
    <form className="space-y-4" onSubmit={submit} aria-busy={verify.isPending}>
      <p className="type-caption">
        Kartaga biriktirilgan telefon raqamiga tasdiqlash kodi yuborildi. Kod kiritilmaguncha bu
        kartaga pul o'tkazilmaydi.
      </p>

      <Field label="Tasdiqlash kodi">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={6}
          required
        />
      </Field>

      {devCode !== null && devCode !== "" && (
        <p className="type-caption">
          Ishlab chiqish rejimidagi kod: <span className="font-mono">{devCode}</span> — haqiqiy SMS
          yuborilmadi, kod server jurnaliga yozildi.
        </p>
      )}

      {verify.isError && (
        <p role="alert" className="text-sm text-destructive">
          {verify.error.message}
        </p>
      )}
      {resend.isError && (
        <p role="alert" className="text-sm text-destructive">
          {resend.error.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" className="min-h-11" disabled={!valid || verify.isPending}>
          {verify.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {verify.isPending ? "Tekshirilmoqda…" : "Tasdiqlash"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          disabled={resend.isPending}
          onClick={() =>
            resend.mutate(methodId, {
              onSuccess: (result) => setDevCode(result.dev_code ?? null),
            })
          }
        >
          {resend.isPending ? "Yuborilmoqda…" : "Qayta yuborish"}
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" onClick={onCancel}>
          Keyinroq
        </Button>
      </div>
    </form>
  );
}

/* --- payout form ------------------------------------------------------------------ */
function PayoutForm({
  sellerId,
  withdrawable,
  methods,
  onDone,
  onAddCard,
}: {
  sellerId: string;
  withdrawable: number;
  methods: PayoutMethodOut[];
  onDone: () => void;
  onAddCard: () => void;
}) {
  const request = useRequestPayout(sellerId);
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState(
    () => (methods.find((method) => method.is_default) ?? methods[0])?.id ?? "",
  );

  const value = Number(amount);
  const belowMinimum = Number.isFinite(value) && value > 0 && value < MIN_PAYOUT;
  const aboveBalance = Number.isFinite(value) && value > withdrawable;
  const valid = Number.isFinite(value) && value >= MIN_PAYOUT && !aboveBalance && methodId !== "";

  if (methods.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          Pul yechish uchun tasdiqlangan karta kerak. Karta qo'shib, SMS kod bilan tasdiqlang.
        </p>
        <Button onClick={onAddCard}>Karta qo'shish</Button>
      </div>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    request.mutate({ amount: value, payout_method_id: methodId }, { onSuccess: onDone });
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field
        label="Summa"
        hint={`Yechish mumkin: ${formatSom(withdrawable)} · eng kam ${groupDigits(MIN_PAYOUT)} so'm.`}
        error={
          aboveBalance
            ? "Balansdagidan ko'p summa so'raladi."
            : belowMinimum
              ? `Eng kam summa ${groupDigits(MIN_PAYOUT)} so'm.`
              : undefined
        }
      >
        <div className="flex gap-2">
          <Input
            type="number"
            min={MIN_PAYOUT}
            // Whole som, any amount: a 1000-step would make "Hammasini" — which
            // is rarely a round number — fail the browser's own validation.
            step={1}
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setAmount(String(Math.floor(withdrawable)))}
          >
            Hammasini
          </Button>
        </div>
      </Field>

      <Field label="Karta" hint="Pul shu kartaga o'tkaziladi.">
        <Select value={methodId} onChange={(event) => setMethodId(event.target.value)} required>
          {methods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.display}
              {method.is_default ? " · asosiy" : ""}
            </option>
          ))}
        </Select>
      </Field>

      {request.isError && <p className="text-sm text-destructive">{request.error.message}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || request.isPending}>
          {request.isPending ? "Yuborilmoqda…" : "So'rov yuborish"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}

/* --- ledger --------------------------------------------------------------------- */
function LedgerSection({ sellerId, lang }: { sellerId: string; lang: "uz" | "ru" }) {
  const [account, setAccount] = useState("ALL");
  const ledger = useLedger(sellerId, {
    account: account === "ALL" ? null : account,
    // A working list, not an archive: the full statement downloads as Excel.
    limit: 40,
  });

  const accounts = useMemo(() => Object.keys(LEDGER_ACCOUNT_UZ), []);

  return (
    <PanelSection
      title="Hisob daftari"
      subtitle="Har bir som qayerdan kelib qayerga ketgani — o'zgartirib bo'lmaydigan yozuvlar."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="type-label text-muted-foreground">Hisob</span>
            <Select
              aria-label="Hisob bo'yicha saralash"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              className="w-48"
            >
              <option value="ALL">Hammasi</option>
              {accounts.map((option) => (
                <option key={option} value={option}>
                  {LEDGER_ACCOUNT_UZ[option] ?? option}
                </option>
              ))}
            </Select>
          </label>
          <ExportButton path={`/export/seller/${sellerId}/ledger`} />
        </div>
      }
    >
      {ledger.isPending ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }, (_, index) => (
            <LineSkeleton key={index} className="h-6 w-full" />
          ))}
        </div>
      ) : ledger.isError ? (
        <div className="p-5">
          <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} compact />
        </div>
      ) : (
        <DataTable
          head={["Sana", "Turi", "Hisob", "Summa", "Izoh"]}
          empty={<p className="type-caption">Bu hisob bo'yicha yozuv yo'q.</p>}
        >
          {ledger.data.map((entry) => {
            const amount = num(entry.amount);
            return (
              <Row key={entry.id}>
                <Cell className="whitespace-nowrap">{formatDateTime(entry.created_at, lang)}</Cell>
                <Cell className="whitespace-nowrap">
                  {LEDGER_KIND_UZ[entry.kind] ?? entry.kind}
                </Cell>
                <Cell className="whitespace-nowrap">
                  {LEDGER_ACCOUNT_UZ[entry.account] ?? entry.account}
                </Cell>
                <Cell
                  numeric
                  className={cn(
                    "whitespace-nowrap",
                    amount > 0 ? "text-success" : amount < 0 ? "text-destructive" : "",
                  )}
                >
                  {amount > 0 ? "+" : ""}
                  {formatSom(amount)}
                </Cell>
                <Cell>
                  <span className="type-caption block max-w-[18rem] truncate">
                    {entry.description ?? "—"}
                  </span>
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      )}
    </PanelSection>
  );
}
