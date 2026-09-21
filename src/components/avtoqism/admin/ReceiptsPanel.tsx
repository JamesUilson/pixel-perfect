/**
 * Cheklar — issuing and reading the receipt for an order.
 *
 * A receipt is a financial record, not a view of the order: the lines, the
 * totals, the buyer and the store are copied into a snapshot at issue and read
 * from there forever after. Issuing twice does not rebuild anything — the
 * server returns the first receipt, with the first number and the first
 * figures — so the button says "chek berish yoki mavjudini ochish" rather than
 * pretending to regenerate a document.
 *
 * There is no marketplace-wide order list in the API, so the entry point is the
 * order's id: an operator arrives here from the Excel register or from a
 * support ticket with that id in hand.
 */
import { useState } from "react";
import { Download, FileCheck2, Loader2, Search } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { num } from "@/components/avtoqism/panel/Charts";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import { Button, Cell, DataTable, Field, Input, Row } from "@/components/avtoqism/panel/Widgets";
import { ApiError, tokens } from "@/lib/api/client";
import { formatDateTime, formatSom } from "@/lib/format";
import {
  useAdminReceipts,
  useIssueReceipt,
  useOrderReceipt,
  type ReceiptOut,
} from "@/lib/query/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ReceiptsPanel({ lang }: { lang: "uz" | "ru" }) {
  const [orderId, setOrderId] = useState("");
  // Looking is separate from issuing on purpose: an operator who only wants to
  // know whether a receipt exists should not create one by asking.
  const [lookupId, setLookupId] = useState<string | null>(null);

  const receipts = useAdminReceipts();
  const issue = useIssueReceipt();
  const lookup = useOrderReceipt(lookupId);

  const trimmed = orderId.trim();
  const valid = UUID.test(trimmed);
  const malformed = trimmed !== "" && !valid;
  // Whichever answer arrived last is the one on screen.
  const shown = issue.data ?? lookup.data ?? null;

  return (
    <div className="space-y-6">
      <PanelSection
        title="Chek berish"
        subtitle="Buyurtma uchun rasmiy chek. Bir marta beriladi va keyin o'zgarmaydi."
      >
        <form
          className="space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            setLookupId(null);
            issue.mutate(trimmed);
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label="Buyurtma ID"
              className="min-w-0 flex-1 sm:max-w-md"
              hint="Buyurtmalar Excel reyestridagi UUID."
              error={malformed ? "Bu UUID ko'rinishida emas." : undefined}
            >
              <Input
                value={orderId}
                onChange={(event) => {
                  setOrderId(event.target.value);
                  setLookupId(null);
                  issue.reset();
                }}
                placeholder="3f0c8b1e-…"
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              disabled={!valid || lookup.isFetching}
              onClick={() => {
                issue.reset();
                setLookupId(trimmed);
              }}
            >
              {lookup.isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Search className="size-4" aria-hidden />
              )}
              Tekshirish
            </Button>
            <Button type="submit" disabled={!valid || issue.isPending}>
              {issue.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <FileCheck2 className="size-4" aria-hidden />
              )}
              {issue.isPending ? "So'ralmoqda…" : "Chek berish yoki mavjudini ochish"}
            </Button>
          </div>

          <p className="type-caption max-w-3xl">
            «Tekshirish» hech narsa yaratmaydi — u faqat shu buyurtmaning cheki bor-yo'qligini
            ko'rsatadi. Chek berilgan paytdagi holatda muzlatiladi. Agar buyurtma uchun chek
            allaqachon berilgan bo'lsa, tugma yangi hujjat yasamaydi — o'sha chek, o'sha raqam va
            o'sha summalar bilan qaytariladi. Buyurtma keyinchalik o'zgarsa ham chek o'zgarmaydi.
          </p>

          {issue.isError && (
            <p role="alert" className="text-sm text-destructive">
              {issue.error.message}
            </p>
          )}
          {lookup.isError && (
            <p role="alert" className="text-sm text-destructive">
              {lookup.error.message}
            </p>
          )}
        </form>

        {shown && (
          <div className="border-t border-border p-5">
            <IssuedReceipt receipt={shown} lang={lang} />
          </div>
        )}
      </PanelSection>

      <PanelSection title="Berilgan cheklar" subtitle="Oxirgi cheklar, eng yangisi birinchi.">
        {receipts.isPending ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <LineSkeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : receipts.isError ? (
          <div className="p-5">
            <ErrorState error={receipts.error} onRetry={() => void receipts.refetch()} compact />
          </div>
        ) : (
          <DataTable
            head={["Chek raqami", "Buyurtma", "Berilgan sana", "Summa", "Hujjat"]}
            empty={<p className="type-caption">Hali birorta chek berilmagan.</p>}
          >
            {receipts.data.map((receipt) => (
              <Row key={receipt.id}>
                <Cell className="whitespace-nowrap font-semibold">{receipt.number}</Cell>
                <Cell className="whitespace-nowrap font-mono text-xs">
                  {receipt.snapshot.order?.number ?? receipt.order_id.slice(0, 8)}
                </Cell>
                <Cell className="whitespace-nowrap">{formatDateTime(receipt.issued_at, lang)}</Cell>
                <Cell numeric className="whitespace-nowrap">
                  {formatSom(num(receipt.grand_total))}
                </Cell>
                <Cell>
                  <ReceiptDocumentButton receipt={receipt} />
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </PanelSection>
    </div>
  );
}

function IssuedReceipt({ receipt, lang }: { receipt: ReceiptOut; lang: "uz" | "ru" }) {
  const totals = receipt.snapshot.totals;
  return (
    <div className="border border-border bg-muted/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="type-label text-muted-foreground">Chek raqami</p>
          <p className="font-display mt-1 text-[1.35rem] font-semibold leading-none tracking-tight">
            {receipt.number}
          </p>
          <p className="type-caption mt-2">
            Berilgan: {formatDateTime(receipt.issued_at, lang)} · format {receipt.document_format}
          </p>
        </div>
        <ReceiptDocumentButton receipt={receipt} />
      </div>

      <dl className="mt-5 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <Pair term="Buyurtma raqami" value={receipt.snapshot.order?.number ?? receipt.order_id} />
        <Pair term="Xaridor" value={receipt.snapshot.buyer?.name ?? "—"} />
        <Pair term="Mahsulotlar" value={formatSom(num(totals?.subtotal ?? receipt.subtotal))} />
        <Pair
          term="Chegirma"
          value={formatSom(num(totals?.discount_total ?? receipt.discount_total))}
        />
        <Pair
          term="Yetkazish"
          value={formatSom(num(totals?.delivery_total ?? receipt.delivery_total))}
        />
        <Pair term="Jami" value={formatSom(num(totals?.grand_total ?? receipt.grand_total))} />
      </dl>

      {receipt.snapshot.sellers && receipt.snapshot.sellers.length > 0 && (
        <p className="type-caption mt-4">
          {receipt.snapshot.sellers.length} ta do'kon:{" "}
          {receipt.snapshot.sellers.map((block) => block.store_name).join(", ")}
        </p>
      )}
    </div>
  );
}

function Pair({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="type-label text-muted-foreground">{term}</dt>
      <dd className="mt-0.5 tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * The PDF comes back as a response body, not as a link to a bucket, and the
 * endpoint needs the bearer token — so it cannot be a plain anchor. The
 * filename is taken from the server's Content-Disposition, which is the receipt
 * number.
 */
function ReceiptDocumentButton({ receipt }: { receipt: ReceiptOut }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const base = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api/v1";
      const access = tokens.access();
      const response = await fetch(`${base}/receipts/${receipt.id}/document`, {
        headers: access ? { Authorization: `Bearer ${access}` } : {},
      });
      if (!response.ok) {
        throw new ApiError(response.status, null, "Chekni yuklab bo'lmadi.");
      }
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = match?.[1] ?? `${receipt.number}.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Yuklab bo'lmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void download()}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Download className="size-4" aria-hidden />
        )}
        {busy ? "Yuklanmoqda…" : "PDF yuklab olish"}
      </Button>
      {error && <span className="mt-1 text-xs text-destructive">{error}</span>}
    </span>
  );
}
