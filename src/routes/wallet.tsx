/**
 * Hisobim — the buyer's own balance.
 *
 * The screen is built around one fact that is easy to get wrong and expensive
 * when you do: **topping up is not the same as being credited.** `POST
 * /me/wallet/topup` opens a payment; the balance moves when the gateway
 * confirms, and the server books that credit exactly once however many times
 * the confirmation is delivered. So nothing here adds the amount to the figure
 * on screen. A top-up produces a payment with a status, the status is shown as
 * it is, and the balance is re-read from the server rather than guessed.
 *
 * The cards follow the same shape as the seller's payout cards on
 * `/seller/finance`, deliberately: it is the same kind of object, the same
 * two-step verification and the same promise — the number goes to the payment
 * provider's tokeniser and nothing else. AVTOQISM stores a token, the bank, the
 * brand and four digits. Nothing on this page echoes a card number back,
 * because there is none to echo.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  ExternalLink,
  Loader2,
  Wallet,
} from "lucide-react";

import { Page, PageTitle } from "@/components/avtoqism/Page";
import { ApiError } from "@/lib/api/client";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { StatTile, num } from "@/components/avtoqism/panel/Charts";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import {
  CardEntry,
  EMPTY_CARD_DRAFT,
  cardDraftIsValid,
  type CardDraft,
} from "@/components/avtoqism/payment/CardEntry";
import { cardDigits, expiryLabel } from "@/components/avtoqism/payment/card-brand";
import { Button, Field, Input, Panel, Pill, Select } from "@/components/avtoqism/panel/Widgets";
import { formatDateTime, formatSom, groupDigits } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useIsAuthenticated } from "@/lib/query/session";
import type { WalletCardOut, WalletTopupOut } from "@/lib/query/wallet";
import {
  MAX_WALLET_CARDS,
  MIN_TOPUP,
  useAddWalletCard,
  useMakeDefaultWalletCard,
  useRemoveWalletCard,
  useResendWalletCardCode,
  useTopup,
  useVerifyWalletCard,
  useWallet,
  useWalletTransactions,
} from "@/lib/query/wallet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [{ title: "Hisobim — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: WalletPage,
});

const CARD_STATUS_UZ: Record<
  string,
  { label: string; tone: "neutral" | "good" | "warning" | "critical" | "info" }
> = {
  PENDING_VERIFICATION: { label: "Tasdiqlanmagan", tone: "warning" },
  VERIFIED: { label: "Tasdiqlangan", tone: "good" },
  REVOKED: { label: "O'chirilgan", tone: "neutral" },
  FAILED: { label: "Bloklangan", tone: "critical" },
};

/** The gateways a buyer is offered. `SANDBOX` is a development adapter, not a bank. */
const GATEWAYS: { value: "CLICK" | "PAYME" | "UZUM_BANK"; label: string }[] = [
  { value: "CLICK", label: "Click" },
  { value: "PAYME", label: "Payme" },
  { value: "UZUM_BANK", label: "Uzum Bank" },
];

const QUICK_AMOUNTS = [50_000, 100_000, 300_000, 1_000_000];

/* --- screen --------------------------------------------------------------------- */
function WalletPage() {
  const signedIn = useIsAuthenticated();
  const wallet = useWallet();
  const [addCardOpen, setAddCardOpen] = useState(false);

  if (!signedIn) return <SignInRequired />;

  const cards = wallet.data?.cards ?? [];
  const usable = cards.filter((card) => card.is_usable);

  return (
    <Page>
      <PageTitle
        eyebrow="AVTOQISM"
        title="Hisobim"
        subtitle="Hisobingizni to'ldiring va buyurtmalarni bir bosishda to'lang."
      />

      {wallet.isPending ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="border border-border bg-card p-5">
              <LineSkeleton className="mb-4 h-3 w-24" />
              <LineSkeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
      ) : wallet.isError ? (
        <ErrorState error={wallet.error} onRetry={() => void wallet.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Balans"
            value={formatSom(num(wallet.data.balance))}
            hint="buyurtma uchun ishlatish mumkin"
            icon={<Wallet className="size-4" aria-hidden />}
          />
          <StatTile
            label="Jami to'ldirilgan"
            value={formatSom(num(wallet.data.lifetime_topped_up))}
          />
          <StatTile label="Jami sarflangan" value={formatSom(num(wallet.data.lifetime_spent))} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TopupSection
          cards={usable}
          onAddCard={() => setAddCardOpen(true)}
          onRefreshBalance={() => void wallet.refetch()}
        />
        <CardsSection
          cards={cards}
          isPending={wallet.isPending}
          onAddCard={() => setAddCardOpen(true)}
        />
      </div>

      <div className="mt-6">
        <TransactionsSection />
      </div>

      <Panel open={addCardOpen} title="Karta qo'shish" onClose={() => setAddCardOpen(false)}>
        {addCardOpen && <AddCardFlow onDone={() => setAddCardOpen(false)} />}
      </Panel>
    </Page>
  );
}

/* --- topping up ------------------------------------------------------------------ */
/**
 * The amount, where it is charged from, and what actually happened.
 *
 * `source` is one control rather than two, because the server takes exactly one
 * of `card_id` and `gateway` and refuses a body with neither.
 */
function TopupSection({
  cards,
  onAddCard,
  onRefreshBalance,
}: {
  cards: WalletCardOut[];
  onAddCard: () => void;
  onRefreshBalance: () => void;
}) {
  const topup = useTopup();
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<string>(() => `gateway:${GATEWAYS[0]?.value ?? "CLICK"}`);
  const [result, setResult] = useState<WalletTopupOut | null>(null);

  const value = Number(amount.replace(/\s/g, ""));
  const tooLow = amount !== "" && Number.isFinite(value) && value < MIN_TOPUP;
  const valid = Number.isFinite(value) && value >= MIN_TOPUP;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || topup.isPending) return;
    const [kind, id] = source.split(":");
    topup.mutate(
      {
        amount: value,
        ...(kind === "card"
          ? { card_id: id ?? null }
          : { gateway: (id ?? "CLICK") as "CLICK" | "PAYME" | "UZUM_BANK" }),
        // Read at submit time, never during render: there is no location on the
        // server and this component is server-rendered like every other.
        return_url: typeof window === "undefined" ? null : window.location.href,
      },
      { onSuccess: setResult },
    );
  }

  return (
    <PanelSection title="Hisobni to'ldirish" subtitle={`Eng kam summa ${formatSom(MIN_TOPUP)}.`}>
      <form className="space-y-4 p-5" onSubmit={submit}>
        <Field
          label="Summa"
          error={tooLow ? `Eng kam to'ldirish summasi ${formatSom(MIN_TOPUP)}.` : undefined}
        >
          <Input
            type="number"
            min={MIN_TOPUP}
            step={1000}
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={String(MIN_TOPUP)}
            required
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => setAmount(String(quick))}
              aria-pressed={value === quick}
              className={cn(
                "min-h-11 border px-3 py-1.5 text-xs font-semibold transition-colors",
                value === quick
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border-strong bg-card hover:bg-muted",
              )}
            >
              {groupDigits(quick)}
            </button>
          ))}
        </div>

        <Field label="Qayerdan to'lanadi">
          <Select value={source} onChange={(event) => setSource(event.target.value)}>
            {cards.length > 0 && (
              <optgroup label="Saqlangan kartalar">
                {cards.map((card) => (
                  <option key={card.id} value={`card:${card.id}`}>
                    {card.display}
                    {card.is_default ? " — asosiy" : ""}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="To'lov tizimlari">
              {GATEWAYS.map((gateway) => (
                <option key={gateway.value} value={`gateway:${gateway.value}`}>
                  {gateway.label}
                </option>
              ))}
            </optgroup>
          </Select>
        </Field>

        {cards.length === 0 && (
          <p className="type-caption">
            Tasdiqlangan karta yo'q.{" "}
            <button type="button" onClick={onAddCard} className="font-semibold text-primary">
              Karta qo'shsangiz
            </button>{" "}
            keyingi to'ldirishlar bir bosishda bo'ladi.
          </p>
        )}

        {topup.isError && (
          <p role="alert" className="text-sm text-destructive">
            {topup.error.message}
          </p>
        )}

        <Button type="submit" className="min-h-11" disabled={!valid || topup.isPending}>
          {topup.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {topup.isPending ? "Ochilmoqda…" : "To'ldirish"}
        </Button>

        {result && <TopupResult result={result} onRefreshBalance={onRefreshBalance} />}
      </form>
    </PanelSection>
  );
}

/**
 * What the gateway said, said back plainly.
 *
 * A `CREATED` or `PENDING` payment is reported as waiting — not as money in the
 * account — because that is what it is, and a buyer who is told otherwise will
 * try to spend a balance the platform has not been paid.
 */
function TopupResult({
  result,
  onRefreshBalance,
}: {
  result: WalletTopupOut;
  onRefreshBalance: () => void;
}) {
  const settled = result.status === "PAID";
  const failed = result.status === "FAILED" || result.status === "CANCELLED";

  return (
    <div
      className={cn(
        "border p-4",
        settled
          ? "border-success/40 bg-success-soft"
          : failed
            ? "border-destructive/40 bg-destructive/8"
            : "border-warning/40 bg-warning/10",
      )}
    >
      <p className="text-sm font-semibold">
        {settled
          ? `${formatSom(num(result.amount))} hisobingizga qo'shildi.`
          : failed
            ? "To'lov amalga oshmadi."
            : `${formatSom(num(result.amount))} uchun to'lov ochildi.`}
      </p>
      <p className="type-caption mt-1">
        {settled
          ? "Balans yangilandi."
          : failed
            ? "Hisobdan hech narsa yechilmadi. Boshqa karta yoki to'lov tizimini tanlab ko'ring."
            : "Pul to'lov tizimi tasdiqlagandan keyin balansga qo'shiladi — bir necha soniya ketishi mumkin."}
      </p>
      <p className="type-caption mt-1">
        To'lov raqami: <span className="font-mono">{result.reference}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {result.payment_url && !settled && !failed && (
          <a
            href={result.payment_url}
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            To'lovni yakunlash
            <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
        {!settled && !failed && (
          <Button variant="outline" onClick={onRefreshBalance}>
            Balansni tekshirish
          </Button>
        )}
      </div>
    </div>
  );
}

/* --- cards ------------------------------------------------------------------------ */
function CardsSection({
  cards,
  isPending,
  onAddCard,
}: {
  cards: WalletCardOut[];
  isPending: boolean;
  onAddCard: () => void;
}) {
  const makeDefault = useMakeDefaultWalletCard();
  const remove = useRemoveWalletCard();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const atLimit = cards.length >= MAX_WALLET_CARDS;

  return (
    <PanelSection
      title="Saqlangan kartalar"
      subtitle="Karta raqami AVTOQISMda saqlanmaydi — faqat bank, turi va oxirgi to'rt raqam."
      action={
        <Button size="sm" onClick={onAddCard} disabled={atLimit}>
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
      ) : cards.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <CreditCard className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
          <p className="type-caption">
            Hali karta qo'shilmagan. Karta qo'shib, telefoningizga kelgan kod bilan tasdiqlang.
          </p>
          <div className="mt-4 flex justify-center">
            <Button onClick={onAddCard}>Karta qo'shish</Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {cards.map((card) => {
            const status = CARD_STATUS_UZ[card.status] ?? {
              label: card.status,
              tone: "neutral" as const,
            };
            const expiry = expiryLabel(card.expires_month, card.expires_year);
            const defaultBusy = makeDefault.isPending && makeDefault.variables === card.id;
            const removeBusy = remove.isPending && remove.variables === card.id;
            const defaultError =
              makeDefault.isError && makeDefault.variables === card.id
                ? makeDefault.error.message
                : null;
            const removeError =
              remove.isError && remove.variables === card.id ? remove.error.message : null;

            return (
              <li key={card.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{card.display}</span>
                  <Pill tone={status.tone}>{status.label}</Pill>
                  {card.is_default && <Pill tone="info">Asosiy</Pill>}
                </div>
                <p className="type-caption mt-1">
                  {card.holder_name ?? "Egasi ko'rsatilmagan"}
                  {expiry ? ` · ${expiry}` : ""}
                </p>

                {card.status === "FAILED" && (
                  <p className="mt-2 border border-destructive/40 bg-destructive/8 px-3 py-2 text-xs text-destructive">
                    Kod bir necha marta noto'g'ri kiritilgani uchun bu karta bloklandi. Uni
                    o'chirib, qaytadan qo'shing.
                  </p>
                )}

                {verifyingId === card.id ? (
                  <div className="mt-3 border border-border p-3">
                    <CardCodeStep
                      cardId={card.id}
                      initialDevCode={null}
                      onDone={() => setVerifyingId(null)}
                      onCancel={() => setVerifyingId(null)}
                    />
                  </div>
                ) : confirmingId === card.id ? (
                  <div className="mt-3 border border-destructive/40 bg-destructive/8 p-3">
                    <p className="text-sm">
                      Bu karta o'chiriladi va undan boshqa to'lov olinmaydi. Davom etamizmi?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        className="min-h-11"
                        disabled={removeBusy}
                        onClick={() =>
                          remove.mutate(card.id, { onSuccess: () => setConfirmingId(null) })
                        }
                      >
                        {removeBusy ? "O'chirilmoqda…" : "Ha, o'chirilsin"}
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
                    {removeError && <p className="mt-2 text-sm text-destructive">{removeError}</p>}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {card.status === "PENDING_VERIFICATION" && (
                      <Button
                        size="sm"
                        className="min-h-11"
                        onClick={() => setVerifyingId(card.id)}
                      >
                        Tasdiqlash
                      </Button>
                    )}
                    {card.is_usable && !card.is_default && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        disabled={defaultBusy}
                        onClick={() => makeDefault.mutate(card.id)}
                      >
                        {defaultBusy ? "Saqlanmoqda…" : "Asosiy qilish"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      className="min-h-11"
                      onClick={() => setConfirmingId(card.id)}
                    >
                      O'chirish
                    </Button>
                  </div>
                )}

                {defaultError && <p className="mt-2 text-sm text-destructive">{defaultError}</p>}
                {removeError && confirmingId !== card.id && (
                  <p className="mt-2 text-sm text-destructive">{removeError}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {atLimit && (
        <p className="type-caption border-t border-border px-5 py-3">
          Eng ko'pi {MAX_WALLET_CARDS} ta karta. Yangisini qo'shish uchun eskisini o'chiring.
        </p>
      )}
    </PanelSection>
  );
}

/* --- adding a card ------------------------------------------------------------------ */
/**
 * Two steps in one panel: the number, then the code.
 *
 * The number lives in component state only until the request returns, and is
 * cleared the moment it does — whether it worked or not. It is never read back,
 * never rendered again and never stored anywhere. What comes back is an id and
 * a masked card.
 */
function AddCardFlow({ onDone }: { onDone: () => void }) {
  const add = useAddWalletCard();

  const [draft, setDraft] = useState<CardDraft>(EMPTY_CARD_DRAFT);
  const [makeDefault, setMakeDefault] = useState(false);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
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
          setPendingCardId(result.card.id);
          setDevCode(result.dev_code);
        },
        onSettled: () => setDraft((current) => ({ ...current, number: "" })),
      },
    );
  }

  if (pendingCardId !== null) {
    return (
      <CardCodeStep
        cardId={pendingCardId}
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
        numberHint="Raqam to'g'ridan-to'g'ri to'lov provayderiga yuboriladi. AVTOQISMda karta raqami saqlanmaydi — faqat bank, turi va oxirgi to'rt raqam qoladi."
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

/**
 * The code step.
 *
 * The server allows five tries and then marks the card FAILED for good — so
 * both numbers are on screen: how many are left, and what happens at zero.
 * The attempts shown are this browser's own tally (the API does not return the
 * count); the lock itself arrives as `too_many_attempts` and is what the UI
 * obeys.
 */
function CardCodeStep({
  cardId,
  initialDevCode,
  onDone,
  onCancel,
}: {
  cardId: string;
  initialDevCode: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const verify = useVerifyWalletCard();
  const resend = useResendWalletCardCode();
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(initialDevCode);
  const [failedHere, setFailedHere] = useState(0);
  const [locked, setLocked] = useState(false);

  const valid = code.length >= 4 && !locked;
  const remaining = Math.max(5 - failedHere, 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || verify.isPending) return;
    verify.mutate(
      { cardId, code },
      {
        onSuccess: onDone,
        onError: (error) => {
          setCode("");
          if (!(error instanceof ApiError)) return;
          if (error.code === "too_many_attempts") {
            setLocked(true);
            return;
          }
          if (error.code === "bad_code") setFailedHere((count) => count + 1);
        },
      },
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit} aria-busy={verify.isPending}>
      <p className="type-caption">
        Hisobingizga biriktirilgan telefon raqamiga tasdiqlash kodi yuborildi. Kod kiritilmaguncha
        bu kartadan to'lov olinmaydi.
      </p>

      {locked ? (
        <div
          role="alert"
          className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-semibold">Urinishlar soni tugadi.</p>
          <p className="mt-1">Bu karta bloklandi. Uni o'chirib, qaytadan qo'shing.</p>
        </div>
      ) : (
        <Field
          label="Tasdiqlash kodi"
          hint={
            failedHere > 0
              ? `${failedHere} ta noto'g'ri urinish — ${remaining} ta qoldi, keyin karta bloklanadi.`
              : "5 marta noto'g'ri kiritilsa, karta bloklanadi."
          }
        >
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
      )}

      {devCode !== null && devCode !== "" && (
        <p className="border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <span className="type-label block">Ishlab chiqish rejimi</span>
          Kod: <span className="font-mono font-bold">{devCode}</span> — haqiqiy SMS yuborilmadi.
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
        {!locked && (
          <Button type="submit" className="min-h-11" disabled={!valid || verify.isPending}>
            {verify.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {verify.isPending ? "Tekshirilmoqda…" : "Tasdiqlash"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          disabled={resend.isPending || locked}
          onClick={() =>
            resend.mutate(cardId, {
              onSuccess: (result) => {
                // A new code resets the server's counter, so this one resets too.
                setDevCode(result.dev_code);
                setFailedHere(0);
                setCode("");
              },
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

/* --- the statement -------------------------------------------------------------------- */
/**
 * Read straight from the ledger, so it cannot drift away from the balance it
 * explains. Each row already carries its Uzbek label from the server; the sign
 * of the amount decides the arrow and nothing is re-worded here.
 */
function TransactionsSection() {
  const { lang } = useLang();
  const [page, setPage] = useState(1);
  const transactions = useWalletTransactions(page);

  const rows = transactions.data?.items ?? [];
  const pages = transactions.data?.pages ?? 0;

  return (
    <PanelSection title="Hisob harakati" subtitle="Balansdagi har bir o'zgarish.">
      {transactions.isPending ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }, (_, index) => (
            <LineSkeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : transactions.isError ? (
        <div className="p-5">
          <ErrorState
            error={transactions.error}
            onRetry={() => void transactions.refetch()}
            compact
          />
        </div>
      ) : rows.length === 0 ? (
        <p className="type-caption px-5 py-14 text-center">
          Hozircha harakat yo'q. Hisobni to'ldirsangiz, bu yerda ko'rinadi.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const value = num(row.amount);
            const incoming = value >= 0;
            return (
              <li key={row.id} className="flex items-center gap-3 px-5 py-3.5">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-8 shrink-0 place-items-center",
                    incoming ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
                  )}
                >
                  {incoming ? (
                    <ArrowDownLeft className="size-4" />
                  ) : (
                    <ArrowUpRight className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.label}</p>
                  <p className="type-caption truncate">
                    {formatDateTime(row.created_at, lang)}
                    {row.description ? ` · ${row.description}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    incoming ? "text-success" : "text-foreground",
                  )}
                >
                  {incoming ? "+" : "−"}
                  {formatSom(Math.abs(value))}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || transactions.isFetching}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
          >
            Oldingi
          </Button>
          <span className="type-caption">
            {page} / {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages || transactions.isFetching}
            onClick={() => setPage((current) => Math.min(current + 1, pages))}
          >
            Keyingi
          </Button>
        </div>
      )}
    </PanelSection>
  );
}
