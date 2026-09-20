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

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import {
  ChartCard,
  RevenueArea,
  StackedBars,
  StatTile,
  num,
} from "@/components/avtoqism/panel/Charts";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
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
import {
  useBalance,
  useLedger,
  usePayouts,
  useRequestPayout,
  useSellerMoneyFlow,
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
            onDone={() => setPayoutOpen(false)}
          />
        )}
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

/* --- payout form ------------------------------------------------------------------ */
function PayoutForm({
  sellerId,
  withdrawable,
  onDone,
}: {
  sellerId: string;
  withdrawable: number;
  onDone: () => void;
}) {
  const request = useRequestPayout(sellerId);
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState("");

  const value = Number(amount);
  const belowMinimum = Number.isFinite(value) && value > 0 && value < MIN_PAYOUT;
  const aboveBalance = Number.isFinite(value) && value > withdrawable;
  const valid =
    Number.isFinite(value) && value >= MIN_PAYOUT && !aboveBalance && account.trim().length >= 4;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    request.mutate({ amount: value, account_label: account.trim() }, { onSuccess: onDone });
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
            step={1000}
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

      <Field
        label="Hisob"
        hint="Bank nomi va karta/hisob raqamining oxirgi to'rt raqami. To'liq raqamni yozmang — u bu yerda saqlanmaydi."
      >
        <Input
          value={account}
          onChange={(event) => setAccount(event.target.value)}
          placeholder="Kapitalbank · 1234"
          maxLength={60}
          required
        />
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
