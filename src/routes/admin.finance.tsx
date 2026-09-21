/**
 * Moliya — the platform's books.
 *
 * The screen opens with the integrity check rather than with the totals,
 * because a total is only worth reading if the ledger it comes from balances.
 * AVTOQISM's ledger is double-entry: every event writes a group of entries that
 * must sum to exactly zero. If a group does not, som have been created or
 * destroyed somewhere in the system, and nothing below on this page can be
 * trusted until that is explained. So it gets the top of the page and a real
 * block, not a green tick in a corner.
 *
 * Below it: what each account holds, the payouts waiting on a human, the rules
 * that decide what the platform charges, and the raw ledger to check any of it.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { PayoutApprovals } from "@/components/avtoqism/admin/PayoutApprovals";
import { num } from "@/components/avtoqism/panel/Charts";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import {
  Button,
  Cell,
  DataTable,
  ExportButton,
  Field,
  Input,
  Panel,
  Pill,
  Row,
  Select,
} from "@/components/avtoqism/panel/Widgets";
import type {
  CommissionRuleIn,
  PaymentGateway,
  PaymentSettingIn,
  PaymentSettingOut,
  PayoutOut,
  SellerOut,
} from "@/lib/api/types";
import { formatDate, formatDateTime, formatSom } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import {
  useActiveGateways,
  useAdminLedger,
  useAdminPayouts,
  useAdminSellers,
  useCommissionRules,
  useCreateCommissionRule,
  useDecidePayout,
  useDeleteCommissionRule,
  useLedgerIntegrity,
  usePaymentSettings,
  usePlatformBalances,
  useSavePaymentSetting,
} from "@/lib/query/admin";
import { useCategories } from "@/lib/query/catalog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({
    meta: [{ title: "Moliya — AVTOQISM" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminFinance,
});

const ACCOUNT_UZ: Record<string, string> = {
  CUSTOMER: "Xaridorlar",
  ESCROW: "Escrow",
  SELLER_PENDING: "Sotuvchilar (kutilmoqda)",
  SELLER_AVAILABLE: "Sotuvchilar (mavjud)",
  PLATFORM_COMMISSION: "Komissiya",
  PLATFORM_DELIVERY: "Yetkazish",
  PLATFORM_ADS: "Reklama",
  PAYOUT: "To'lovlar",
  REFUND: "Qaytarishlar",
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

const PAYOUT_STATUS_UZ: Record<
  string,
  { label: string; tone: "neutral" | "good" | "warning" | "critical" | "info" }
> = {
  REQUESTED: { label: "So'ralgan", tone: "warning" },
  APPROVED: { label: "Tasdiqlangan", tone: "info" },
  PROCESSING: { label: "Jarayonda", tone: "info" },
  PAID: { label: "To'langan", tone: "good" },
  REJECTED: { label: "Rad etildi", tone: "critical" },
  FAILED: { label: "Xatolik", tone: "critical" },
};

const GATEWAY_UZ: Record<string, string> = {
  CLICK: "Click",
  PAYME: "Payme",
  UZUM_BANK: "Uzum Bank",
  SANDBOX: "Sinov rejimi",
};

/**
 * Which of a gateway's `fields` entries are credentials the form must collect,
 * and which of those are secrets that must never be shown or pre-filled.
 * `docs` is a link, not an input, so it is handled separately.
 */
const GATEWAY_INPUT_KEYS = ["merchant_id", "service_id", "secret_key", "callback_secret"] as const;
const GATEWAY_SECRET_KEYS = new Set<string>(["secret_key", "callback_secret"]);

const SCOPE_UZ: Record<string, string> = {
  GLOBAL: "Butun platforma",
  CATEGORY: "Kategoriya",
  SELLER: "Sotuvchi",
};

/** A uuid is unreadable in a table; its first block is enough to match a row. */
function shortId(id: string): string {
  return id.slice(0, 8);
}

function sellerName(sellers: SellerOut[] | undefined, id: string): string {
  return sellers?.find((seller) => seller.id === id)?.store_name ?? shortId(id);
}

function TableSkeleton({ rows = 5 }: { rows?: number | undefined }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }, (_, index) => (
        <LineSkeleton key={index} className="h-6 w-full" />
      ))}
    </div>
  );
}

/* --- screen ------------------------------------------------------------------------ */
function AdminFinance() {
  const { lang } = useLang();
  const sellers = useAdminSellers();

  return (
    <div className="space-y-6">
      <IntegrityStrip />
      <AccountsSection />
      <PaymentGatewaysSection lang={lang} />
      <PayoutApprovals lang={lang} />
      <PayoutQueue sellers={sellers.data} lang={lang} />
      <CommissionRulesSection sellers={sellers.data} />
      <LedgerExplorer sellers={sellers.data} lang={lang} />
    </div>
  );
}

/* --- integrity --------------------------------------------------------------------- */
function IntegrityStrip() {
  const integrity = useLedgerIntegrity();

  if (integrity.isPending) {
    return (
      <section className="border border-border bg-card p-5">
        <LineSkeleton className="mb-3 h-4 w-48" />
        <LineSkeleton className="h-3 w-full max-w-xl" />
      </section>
    );
  }

  if (integrity.isError) {
    return <ErrorState error={integrity.error} onRetry={() => void integrity.refetch()} />;
  }

  if (integrity.data.balanced) {
    return (
      <section className="flex items-start gap-3 border border-success/40 bg-success-soft px-5 py-4">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-success">Hisob daftari muvozanatda</p>
          <p className="type-caption mt-1 max-w-3xl">
            Har bir hodisa yozuvlar guruhini yaratadi va har bir guruhning yig'indisi aniq nolga
            teng — pul yo'qdan paydo bo'lmagan va yo'qolmagan. Quyidagi barcha raqamlar shu
            daftardan olinadi.
          </p>
        </div>
      </section>
    );
  }

  const groups = integrity.data.groups;

  return (
    <section role="alert" className="border-2 border-destructive bg-destructive/8 px-5 py-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-6 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="type-h3 text-destructive">Hisob daftari muvozanatda emas</h3>
          <p className="type-caption mt-1 max-w-3xl">
            {groups.length} ta yozuvlar guruhining yig'indisi nolga teng emas. Bu shuni anglatadiki,
            hisob daftarida pul yo'qdan paydo bo'lgan yoki yo'qolgan. Quyidagi summalar va to'lovlar
            bu tuzatilmaguncha ishonchli emas — darhol texnik jamoaga xabar bering va yangi
            to'lovlarni tasdiqlamang.
          </p>
          <div className="mt-4 border border-destructive/40 bg-card">
            <DataTable head={["Guruh", "Farq"]}>
              {groups.map((group) => (
                <Row key={group.group_id}>
                  <Cell className="whitespace-nowrap font-mono text-xs">{group.group_id}</Cell>
                  <Cell numeric className="whitespace-nowrap text-destructive">
                    {formatSom(num(group.difference))}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- accounts ----------------------------------------------------------------------- */
function AccountsSection() {
  const balances = usePlatformBalances();

  return (
    <PanelSection
      title="Hisoblar"
      subtitle="Har bir ichki hisobdagi joriy qoldiq. Yig'indisi har doim nolga teng bo'lishi kerak."
    >
      {balances.isPending ? (
        <TableSkeleton />
      ) : balances.isError ? (
        <div className="p-5">
          <ErrorState error={balances.error} onRetry={() => void balances.refetch()} compact />
        </div>
      ) : (
        <DataTable
          head={["Hisob", "Summa"]}
          empty={<p className="type-caption">Hali hech qanday yozuv yo'q.</p>}
        >
          {balances.data.map((account) => {
            const total = num(account.total);
            return (
              <Row key={account.account}>
                <Cell className="whitespace-nowrap font-semibold">
                  {ACCOUNT_UZ[account.account] ?? account.account}
                </Cell>
                <Cell
                  numeric
                  className={cn(
                    "whitespace-nowrap",
                    total > 0 ? "text-success" : total < 0 ? "text-destructive" : "",
                  )}
                >
                  {total > 0 ? "+" : ""}
                  {formatSom(total)}
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      )}
    </PanelSection>
  );
}

/* --- payment gateways -------------------------------------------------------------------- */
/**
 * What a buyer can pay with, and with whose credentials.
 *
 * Two things this screen is careful about. A stored secret is never sent back
 * by the server, so the form starts blank and a blank field means "keep it" —
 * saving a gateway without retyping the key must not wipe it. And the provider
 * that takes payments is not necessarily the one that holds saved cards, so
 * that is said out loud below rather than left to be assumed.
 */
function PaymentGatewaysSection({ lang }: { lang: "uz" | "ru" }) {
  const settings = usePaymentSettings();
  const active = useActiveGateways();
  const save = useSavePaymentSetting();
  const [editing, setEditing] = useState<PaymentSettingOut | null>(null);

  const togglingGateway = save.isPending ? (save.variables?.gateway ?? null) : null;

  return (
    <PanelSection
      title="To'lov tizimlari"
      subtitle="Har bir tizim o'zining kalitlari bilan ishlaydi. Kalitlar shifrlangan holda saqlanadi va bu yerda hech qachon ochiq ko'rsatilmaydi."
    >
      {settings.isPending ? (
        <TableSkeleton rows={4} />
      ) : settings.isError ? (
        <div className="p-5">
          <ErrorState error={settings.error} onRetry={() => void settings.refetch()} compact />
        </div>
      ) : (
        <ul className="grid gap-px bg-border">
          {settings.data.map((row) => {
            const fields = row.fields;
            const busy = togglingGateway === row.gateway;
            const rowError =
              save.isError && save.variables?.gateway === row.gateway ? save.error.message : null;
            const usesSecret = (fields["secret_key"] ?? "") !== "";
            const docs = fields["docs"] ?? "";

            return (
              <li key={row.gateway} className="bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base font-bold">
                    {GATEWAY_UZ[row.gateway] ?? row.gateway}
                  </span>
                  <Pill tone={row.is_active ? "good" : row.configured ? "info" : "neutral"}>
                    {row.is_active ? "Faol" : row.configured ? "Sozlangan" : "Sozlanmagan"}
                  </Pill>
                  <Pill tone={row.is_live ? "warning" : "neutral"}>
                    {row.is_live ? "Jonli" : "Test"}
                  </Pill>
                </div>

                <dl className="type-caption mt-3 grid gap-1 sm:grid-cols-2">
                  {(fields["merchant_id"] ?? "") !== "" && (
                    <div className="flex gap-2">
                      <dt>{fields["merchant_id"]}:</dt>
                      <dd className="font-mono">{row.merchant_id ?? "—"}</dd>
                    </div>
                  )}
                  {(fields["service_id"] ?? "") !== "" && (
                    <div className="flex gap-2">
                      <dt>{fields["service_id"]}:</dt>
                      <dd className="font-mono">{row.service_id ?? "—"}</dd>
                    </div>
                  )}
                  {usesSecret && (
                    <div className="flex gap-2">
                      <dt>{fields["secret_key"]}:</dt>
                      <dd className="font-mono">
                        {row.secret_key_hint === "" ? "—" : row.secret_key_hint}
                      </dd>
                    </div>
                  )}
                  <div className="flex gap-2 sm:col-span-2">
                    <dt>
                      {row.last_success_at
                        ? "oxirgi muvaffaqiyatli to'lov:"
                        : "hali to'lov bo'lmagan"}
                    </dt>
                    {row.last_success_at && <dd>{formatDateTime(row.last_success_at, lang)}</dd>}
                  </div>
                </dl>

                {row.note && <p className="type-caption mt-2">{row.note}</p>}
                {docs !== "" && (
                  <p className="type-caption mt-2">
                    <a
                      href={docs}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline underline-offset-2"
                    >
                      Hujjatlar
                    </a>
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                    Sozlash
                  </Button>
                  <Button
                    size="sm"
                    variant={row.is_active ? "danger" : "primary"}
                    disabled={busy}
                    onClick={() => save.mutate({ gateway: row.gateway, is_active: !row.is_active })}
                  >
                    {busy ? "…" : row.is_active ? "O'chirish" : "Yoqish"}
                  </Button>
                </div>

                {rowError && <p className="mt-2 text-sm text-destructive">{rowError}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-border px-5 py-4">
        {active.isPending ? (
          <LineSkeleton className="h-4 w-64" />
        ) : active.isError ? (
          <ErrorState error={active.error} onRetry={() => void active.refetch()} compact />
        ) : (
          <>
            <p className="text-sm">
              {active.data.gateways.length === 0
                ? "Hozircha birorta to'lov tizimi yoqilmagan."
                : `Yoqilgan to'lov tizimlari: ${active.data.gateways
                    .map((gateway) => GATEWAY_UZ[gateway] ?? gateway)
                    .join(", ")}.`}
            </p>
            <p className="type-caption mt-1">
              Xaridor har doim naqd pul bilan to'lay oladi. Kartalarni saqlash moduli:{" "}
              {active.data.card_tokenizer}.
            </p>
            {active.data.card_tokenizer_note !== "" && (
              <p className="mt-3 border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                {active.data.card_tokenizer_note}
              </p>
            )}
          </>
        )}
      </div>

      <Panel
        open={editing !== null}
        title={editing ? (GATEWAY_UZ[editing.gateway] ?? editing.gateway) : ""}
        onClose={() => setEditing(null)}
      >
        {editing && <GatewayForm setting={editing} onDone={() => setEditing(null)} />}
      </Panel>
    </PanelSection>
  );
}

function GatewayForm({ setting, onDone }: { setting: PaymentSettingOut; onDone: () => void }) {
  const save = useSavePaymentSetting();
  const fields = setting.fields;

  const [merchantId, setMerchantId] = useState(setting.merchant_id ?? "");
  const [serviceId, setServiceId] = useState(setting.service_id ?? "");
  // The secrets start empty and stay empty unless the admin retypes them: the
  // form never received the stored value, so it must not be able to overwrite it
  // with a blank.
  const [secretKey, setSecretKey] = useState("");
  const [callbackSecret, setCallbackSecret] = useState("");
  const [isLive, setIsLive] = useState(setting.is_live);
  const [returnUrl, setReturnUrl] = useState(setting.return_url ?? "");
  const [note, setNote] = useState(setting.note ?? "");

  const used = (key: (typeof GATEWAY_INPUT_KEYS)[number]) => (fields[key] ?? "") !== "";
  const label = (key: (typeof GATEWAY_INPUT_KEYS)[number]) => fields[key] ?? key;
  const anyInput = GATEWAY_INPUT_KEYS.some((key) => used(key));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const body: PaymentSettingIn & { gateway: PaymentGateway } = {
      gateway: setting.gateway,
      is_live: isLive,
      return_url: returnUrl.trim(),
      note: note.trim(),
    };
    if (used("merchant_id")) body.merchant_id = merchantId.trim();
    if (used("service_id")) body.service_id = serviceId.trim();
    if (used("secret_key") && secretKey !== "") body.secret_key = secretKey;
    if (used("callback_secret") && callbackSecret !== "") body.callback_secret = callbackSecret;
    save.mutate(body, {
      onSuccess: onDone,
      // A secret lives in this form only as long as the request does.
      onSettled: () => {
        setSecretKey("");
        setCallbackSecret("");
      },
    });
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {!anyInput && (
        <p className="type-caption">
          Bu tizim hech qanday kalit talab qilmaydi — uni shunchaki yoqish kifoya.
        </p>
      )}

      {used("merchant_id") && (
        <Field label={label("merchant_id")}>
          <Input
            value={merchantId}
            onChange={(event) => setMerchantId(event.target.value)}
            maxLength={120}
            autoComplete="off"
          />
        </Field>
      )}

      {used("service_id") && (
        <Field label={label("service_id")}>
          <Input
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            maxLength={120}
            autoComplete="off"
          />
        </Field>
      )}

      {used("secret_key") && (
        <Field
          label={label("secret_key")}
          hint={
            setting.secret_key_hint === ""
              ? "Hozircha kalit saqlanmagan."
              : `Saqlangan kalit: ${setting.secret_key_hint}. Bo'sh qoldirilsa, o'sha kalit o'zgarmaydi.`
          }
        >
          <Input
            type="password"
            value={secretKey}
            onChange={(event) => setSecretKey(event.target.value)}
            maxLength={400}
            autoComplete="new-password"
          />
        </Field>
      )}

      {used("callback_secret") && (
        <Field
          label={label("callback_secret")}
          hint={
            setting.callback_secret_hint === ""
              ? "Hozircha kalit saqlanmagan."
              : `Saqlangan kalit: ${setting.callback_secret_hint}. Bo'sh qoldirilsa, o'sha kalit o'zgarmaydi.`
          }
        >
          <Input
            type="password"
            value={callbackSecret}
            onChange={(event) => setCallbackSecret(event.target.value)}
            maxLength={400}
            autoComplete="new-password"
          />
        </Field>
      )}

      <Field label="Qaytish manzili" hint="To'lovdan keyin xaridor shu manzilga qaytariladi.">
        <Input
          value={returnUrl}
          onChange={(event) => setReturnUrl(event.target.value)}
          maxLength={500}
          placeholder="https://avtoqism.uz/orders"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 border border-input accent-primary"
          checked={isLive}
          onChange={(event) => setIsLive(event.target.checked)}
        />
        Jonli rejim — haqiqiy pul
      </label>

      <Field label="Izoh" hint="Bu kalitlar kimning kabinetidan olingani — keyin kerak bo'ladi.">
        <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
      </Field>

      {save.isError && <p className="text-sm text-destructive">{save.error.message}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}

/* --- payouts -------------------------------------------------------------------------- */
function PayoutQueue({ sellers, lang }: { sellers: SellerOut[] | undefined; lang: "uz" | "ru" }) {
  const payouts = useAdminPayouts();
  const decide = useDecidePayout();
  const [rejecting, setRejecting] = useState<PayoutOut | null>(null);
  const [reason, setReason] = useState("");

  const busyId = decide.isPending ? (decide.variables?.payoutId ?? null) : null;

  function act(payoutId: string, status: string) {
    decide.mutate({ payoutId, status });
  }

  function submitRejection(event: React.FormEvent) {
    event.preventDefault();
    if (!rejecting || reason.trim().length < 3) return;
    decide.mutate(
      { payoutId: rejecting.id, status: "REJECTED", note: reason.trim() },
      {
        onSuccess: () => {
          setRejecting(null);
          setReason("");
        },
      },
    );
  }

  return (
    <PanelSection
      title="To'lovlar reyestri"
      subtitle="Barcha to'lov so'rovlari va ularning bosqichma-bosqich holati."
      action={<ExportButton path="/export/admin/payouts" />}
    >
      <p className="border-b border-warning/40 bg-warning/10 px-5 py-3 text-sm">
        Odatdagi qaror yuqoridagi «To'lov so'rovlarini tasdiqlash» bo'limida qabul qilinadi. Bu
        yerdagi tugmalar holatni bosqichma-bosqich siljitadi — masalan, o'tkazma bankda osilib
        qolganda «Xatolik» deb belgilash uchun. «To'landi» pulni hisobdan chiqaradi; uni faqat
        o'tkazma haqiqatan ham amalga oshirilgandan keyin bosing.
      </p>

      {decide.isError && (
        <p className="border-b border-destructive/30 bg-destructive/8 px-5 py-3 text-sm text-destructive">
          {decide.error.message}
        </p>
      )}

      {payouts.isPending ? (
        <TableSkeleton />
      ) : payouts.isError ? (
        <div className="p-5">
          <ErrorState error={payouts.error} onRetry={() => void payouts.refetch()} compact />
        </div>
      ) : (
        <DataTable
          head={["Raqam", "Do'kon", "So'ralgan", "Summa", "Hisob", "Holat", "Amal"]}
          empty={<p className="type-caption">Hozircha to'lov so'rovlari yo'q.</p>}
        >
          {payouts.data.map((payout) => {
            const status = PAYOUT_STATUS_UZ[payout.status] ?? {
              label: payout.status,
              tone: "neutral" as const,
            };
            const busy = busyId === payout.id;
            return (
              <Row key={payout.id}>
                <Cell className="whitespace-nowrap font-semibold">{payout.reference}</Cell>
                <Cell className="whitespace-nowrap">{sellerName(sellers, payout.seller_id)}</Cell>
                <Cell className="whitespace-nowrap">{formatDate(payout.created_at, lang)}</Cell>
                <Cell numeric className="whitespace-nowrap">
                  {formatSom(num(payout.amount))}
                </Cell>
                <Cell className="whitespace-nowrap">{payout.account_label ?? "—"}</Cell>
                <Cell>
                  <Pill tone={status.tone}>{status.label}</Pill>
                </Cell>
                <Cell>
                  <div className="flex flex-wrap gap-2">
                    {payout.status === "REQUESTED" && (
                      <>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => act(payout.id, "APPROVED")}
                        >
                          {busy ? "…" : "Tasdiqlash"}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => {
                            setRejecting(payout);
                            setReason("");
                          }}
                        >
                          Rad etish
                        </Button>
                      </>
                    )}
                    {payout.status === "APPROVED" && (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => act(payout.id, "PAID")}>
                          {busy ? "…" : "To'landi"}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => act(payout.id, "FAILED")}
                        >
                          Xatolik
                        </Button>
                      </>
                    )}
                    {payout.status !== "REQUESTED" && payout.status !== "APPROVED" && (
                      <span className="type-caption">
                        {payout.failure_reason ?? payout.note ?? "—"}
                      </span>
                    )}
                  </div>
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      )}

      <Panel
        open={rejecting !== null}
        title="To'lovni rad etish"
        onClose={() => setRejecting(null)}
      >
        <form className="space-y-4" onSubmit={submitRejection}>
          <p className="type-caption">
            {rejecting ? `${rejecting.reference} · ${formatSom(num(rejecting.amount))}` : ""}
          </p>
          <Field label="Sabab" hint="Sotuvchi bu matnni ko'radi, shuning uchun aniq yozing.">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Hisob raqami noto'g'ri"
              maxLength={300}
              required
            />
          </Field>
          {decide.isError && <p className="text-sm text-destructive">{decide.error.message}</p>}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="danger"
              disabled={reason.trim().length < 3 || decide.isPending}
            >
              {decide.isPending ? "Yuborilmoqda…" : "Rad etish"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRejecting(null)}>
              Bekor qilish
            </Button>
          </div>
        </form>
      </Panel>
    </PanelSection>
  );
}

/* --- commission rules -------------------------------------------------------------------- */
function CommissionRulesSection({ sellers }: { sellers: SellerOut[] | undefined }) {
  const rules = useCommissionRules();
  const remove = useDeleteCommissionRule();
  const categories = useCategories();
  const [createOpen, setCreateOpen] = useState(false);

  const categoryName = (id: string) =>
    categories.data?.find((category) => category.id === id)?.name_uz ?? shortId(id);

  return (
    <PanelSection
      title="Komissiya qoidalari"
      subtitle="Eng aniq faol qoida ishlaydi: avval sotuvchi, keyin kategoriya, oxirida butun platforma."
      action={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden /> Qoida qo'shish
        </Button>
      }
    >
      {remove.isError && (
        <p className="border-b border-destructive/30 bg-destructive/8 px-5 py-3 text-sm text-destructive">
          {remove.error.message}
        </p>
      )}

      {rules.isPending ? (
        <TableSkeleton />
      ) : rules.isError ? (
        <div className="p-5">
          <ErrorState error={rules.error} onRetry={() => void rules.refetch()} compact />
        </div>
      ) : (
        <DataTable
          head={["Qamrov", "Foiz", "Eng kam", "Eng ko'p", "Faol", "Izoh", ""]}
          empty={
            <p className="type-caption">
              Hali qoida yo'q — komissiya standart qiymat bo'yicha hisoblanadi.
            </p>
          }
        >
          {rules.data.map((rule) => (
            <Row key={rule.id}>
              <Cell>
                <span className="font-semibold">{SCOPE_UZ[rule.scope] ?? rule.scope}</span>
                {rule.scope === "CATEGORY" && rule.category_id && (
                  <span className="type-caption block">{categoryName(rule.category_id)}</span>
                )}
                {rule.scope === "SELLER" && rule.seller_id && (
                  <span className="type-caption block">{sellerName(sellers, rule.seller_id)}</span>
                )}
              </Cell>
              <Cell numeric className="whitespace-nowrap">
                {num(rule.percent).toFixed(2)}%
              </Cell>
              <Cell numeric className="whitespace-nowrap">
                {rule.min_fee == null ? "—" : formatSom(num(rule.min_fee))}
              </Cell>
              <Cell numeric className="whitespace-nowrap">
                {rule.max_fee == null ? "—" : formatSom(num(rule.max_fee))}
              </Cell>
              <Cell>
                <Pill tone={rule.is_active ? "good" : "neutral"}>
                  {rule.is_active ? "Faol" : "O'chiq"}
                </Pill>
              </Cell>
              <Cell>
                <span className="type-caption block max-w-[18rem] truncate">
                  {rule.note ?? "—"}
                </span>
              </Cell>
              <Cell>
                <Button
                  size="sm"
                  variant="danger"
                  aria-label={`${SCOPE_UZ[rule.scope] ?? rule.scope} qoidasini o'chirish`}
                  disabled={remove.isPending && remove.variables === rule.id}
                  onClick={() => remove.mutate(rule.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      <Panel open={createOpen} title="Komissiya qoidasi" onClose={() => setCreateOpen(false)}>
        {createOpen && (
          <CommissionRuleForm
            sellers={sellers}
            categories={categories.data ?? []}
            onDone={() => setCreateOpen(false)}
          />
        )}
      </Panel>
    </PanelSection>
  );
}

function CommissionRuleForm({
  sellers,
  categories,
  onDone,
}: {
  sellers: SellerOut[] | undefined;
  categories: { id: string; name_uz: string }[];
  onDone: () => void;
}) {
  const create = useCreateCommissionRule();
  const [scope, setScope] = useState<"GLOBAL" | "CATEGORY" | "SELLER">("GLOBAL");
  const [percent, setPercent] = useState("5");
  const [categoryId, setCategoryId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [minFee, setMinFee] = useState("");
  const [maxFee, setMaxFee] = useState("");
  const [note, setNote] = useState("");

  const percentValue = Number(percent);
  const percentValid = Number.isFinite(percentValue) && percentValue >= 0 && percentValue <= 50;
  const targetValid =
    scope === "GLOBAL" ||
    (scope === "CATEGORY" ? categoryId !== "" : scope === "SELLER" ? sellerId !== "" : false);
  const valid = percentValid && targetValid;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const input: CommissionRuleIn = {
      scope,
      percent: percentValue,
      category_id: scope === "CATEGORY" ? categoryId : null,
      seller_id: scope === "SELLER" ? sellerId : null,
      min_fee: minFee.trim() === "" ? null : Number(minFee),
      max_fee: maxFee.trim() === "" ? null : Number(maxFee),
      note: note.trim() === "" ? null : note.trim(),
    };
    create.mutate(input, { onSuccess: onDone });
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <p className="type-caption">
        Bir buyurtmaga faqat bitta qoida qo'llanadi — eng aniqi. Sotuvchi uchun qoida bo'lsa, u
        kategoriya qoidasini ham, umumiy qoidani ham bosadi.
      </p>

      <Field label="Qamrov">
        <Select
          value={scope}
          onChange={(event) => setScope(event.target.value as "GLOBAL" | "CATEGORY" | "SELLER")}
        >
          <option value="GLOBAL">Butun platforma</option>
          <option value="CATEGORY">Kategoriya</option>
          <option value="SELLER">Sotuvchi</option>
        </Select>
      </Field>

      {scope === "CATEGORY" && (
        <Field label="Kategoriya">
          <Select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            <option value="">Tanlang</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name_uz}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {scope === "SELLER" && (
        <Field label="Sotuvchi">
          <Select value={sellerId} onChange={(event) => setSellerId(event.target.value)} required>
            <option value="">Tanlang</option>
            {(sellers ?? []).map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.store_name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field
        label="Foiz"
        hint="0 dan 50 gacha. Buyurtma summasining shu qismi platformaga qoladi."
        error={percentValid ? undefined : "Foiz 0 va 50 orasida bo'lishi kerak."}
      >
        <Input
          type="number"
          min={0}
          max={50}
          step={0.1}
          inputMode="decimal"
          value={percent}
          onChange={(event) => setPercent(event.target.value)}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Eng kam summa" hint="Bo'sh qoldirilsa chegara yo'q.">
          <Input
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            value={minFee}
            onChange={(event) => setMinFee(event.target.value)}
          />
        </Field>
        <Field label="Eng ko'p summa" hint="Bo'sh qoldirilsa chegara yo'q.">
          <Input
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            value={maxFee}
            onChange={(event) => setMaxFee(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Izoh" hint="Nega bu qoida qo'yilgani — keyin o'zingizga kerak bo'ladi.">
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
          placeholder="Yangi sotuvchilar uchun chegirmali komissiya"
        />
      </Field>

      {create.isError && <p className="text-sm text-destructive">{create.error.message}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || create.isPending}>
          {create.isPending ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}

/* --- ledger ------------------------------------------------------------------------------- */
function LedgerExplorer({
  sellers,
  lang,
}: {
  sellers: SellerOut[] | undefined;
  lang: "uz" | "ru";
}) {
  const [sellerId, setSellerId] = useState("ALL");
  const [account, setAccount] = useState("ALL");

  const ledger = useAdminLedger({
    seller_id: sellerId === "ALL" ? null : sellerId,
    account: account === "ALL" ? null : account,
    limit: 200,
  });

  const accounts = useMemo(() => Object.keys(ACCOUNT_UZ), []);

  return (
    <PanelSection
      title="Hisob daftari"
      subtitle="Platformadagi har bir yozuv. O'zgartirib bo'lmaydi — faqat yangi yozuv qo'shiladi."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="type-label text-muted-foreground">Do'kon</span>
            <Select
              aria-label="Do'kon bo'yicha saralash"
              value={sellerId}
              onChange={(event) => setSellerId(event.target.value)}
              className="w-48"
            >
              <option value="ALL">Hammasi</option>
              {(sellers ?? []).map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.store_name}
                </option>
              ))}
            </Select>
          </label>
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
                  {ACCOUNT_UZ[option] ?? option}
                </option>
              ))}
            </Select>
          </label>
          <ExportButton path="/export/admin/ledger" />
        </div>
      }
    >
      {ledger.isPending ? (
        <TableSkeleton rows={8} />
      ) : ledger.isError ? (
        <div className="p-5">
          <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} compact />
        </div>
      ) : (
        <DataTable
          head={["Sana", "Guruh", "Turi", "Hisob", "Summa", "Izoh"]}
          empty={<p className="type-caption">Bu saralash bo'yicha yozuv yo'q.</p>}
        >
          {ledger.data.map((entry) => {
            const amount = num(entry.amount);
            return (
              <Row key={entry.id}>
                <Cell className="whitespace-nowrap">{formatDateTime(entry.created_at, lang)}</Cell>
                <Cell className="whitespace-nowrap font-mono text-xs">
                  {shortId(entry.group_id)}
                </Cell>
                <Cell className="whitespace-nowrap">
                  {LEDGER_KIND_UZ[entry.kind] ?? entry.kind}
                </Cell>
                <Cell className="whitespace-nowrap">
                  {ACCOUNT_UZ[entry.account] ?? entry.account}
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
