/**
 * The seller's own catalogue — one row per offer.
 *
 * The distinction that governs this screen: the product is shared property of
 * the marketplace and changing it needs moderation, while the price and the
 * stock are the shop's own and take effect the moment they are saved. So the
 * editor here only ever touches the offer.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "@/components/avtoqism/Page";
import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { PanelSection, PanelToolbar } from "@/components/avtoqism/panel/PanelShell";
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
  Row,
  Select,
} from "@/components/avtoqism/panel/Widgets";
import type { OfferStatus, ProductCondition, SellerOfferRow } from "@/lib/api/types";
import { formatSom, groupDigits } from "@/lib/format";
import { useSellerOffers, useUpsertOffer } from "@/lib/query/seller";

export const Route = createFileRoute("/seller/products")({
  head: () => ({
    meta: [{ title: "Mahsulotlar — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: SellerProducts,
});

/** Only the three a seller may set; ARCHIVED is an administrative state. */
const EDITABLE_STATUSES: { value: OfferStatus; label: string }[] = [
  { value: "ACTIVE", label: "Faol" },
  { value: "PAUSED", label: "To'xtatilgan" },
  { value: "OUT_OF_STOCK", label: "Tugagan" },
];

const OFFER_STATUS_UZ: Record<OfferStatus, string> = {
  ACTIVE: "Faol",
  PAUSED: "To'xtatilgan",
  OUT_OF_STOCK: "Tugagan",
  ARCHIVED: "Arxivlangan",
};

function offerTone(status: OfferStatus): "good" | "warning" | "critical" | "neutral" {
  if (status === "ACTIVE") return "good";
  if (status === "PAUSED") return "warning";
  if (status === "OUT_OF_STOCK") return "critical";
  return "neutral";
}

type FormState = {
  productId: string;
  productName: string;
  /** True when the row was opened from its own "Tahrirlash" button. */
  locked: boolean;
  condition: ProductCondition;
  price: string;
  oldPrice: string;
  stock: string;
  status: OfferStatus;
  warrantyMonths: string;
  deliveryDays: string;
};

function formFrom(row: SellerOfferRow, locked: boolean): FormState {
  return {
    productId: row.product_id,
    productName: row.product_name,
    locked,
    condition: row.condition,
    price: row.price,
    oldPrice: row.old_price ?? "",
    stock: String(row.stock),
    status: row.status === "ARCHIVED" ? "PAUSED" : row.status,
    warrantyMonths: "",
    deliveryDays: "",
  };
}

const BLANK_FORM: FormState = {
  productId: "",
  productName: "",
  locked: false,
  condition: "NEW",
  price: "",
  oldPrice: "",
  stock: "",
  status: "ACTIVE",
  warrantyMonths: "",
  deliveryDays: "",
};

function SellerProducts() {
  const sellerId = useSellerId();
  const offers = useSellerOffers(sellerId);
  const upsert = useUpsertOffer(sellerId);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "OUT_OF_STOCK">("ALL");
  const [form, setForm] = useState<FormState | null>(null);
  const [touched, setTouched] = useState(false);

  const rows = useMemo(() => offers.data ?? [], [offers.data]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!needle) return true;
      const oem = row.oem_number ?? "";
      return row.product_name.toLowerCase().includes(needle) || oem.toLowerCase().includes(needle);
    });
  }, [rows, search, statusFilter]);

  function open(next: FormState) {
    upsert.reset();
    setTouched(false);
    setForm(next);
  }

  function close() {
    setForm(null);
    setTouched(false);
    upsert.reset();
  }

  const priceValue = form ? Number(form.price) : Number.NaN;
  const stockValue = form ? Number(form.stock) : Number.NaN;
  const priceError =
    form && !Number.isFinite(priceValue)
      ? "Narxni raqam bilan kiriting."
      : form && priceValue <= 0
        ? "Narx noldan katta bo'lishi kerak."
        : undefined;
  const stockError =
    form && !Number.isInteger(stockValue)
      ? "Qoldiqni butun son bilan kiriting."
      : form && stockValue < 0
        ? "Qoldiq manfiy bo'la olmaydi."
        : undefined;
  const productError = form && !form.productId ? "Mahsulotni tanlang." : undefined;
  const invalid = Boolean(priceError ?? stockError ?? productError);

  function submit() {
    if (!form) return;
    setTouched(true);
    if (invalid) return;
    upsert.mutate(
      {
        product_id: form.productId,
        price: priceValue,
        old_price: form.oldPrice.trim() === "" ? null : Number(form.oldPrice),
        stock: stockValue,
        condition: form.condition,
        status: form.status,
        warranty_months: form.warrantyMonths.trim() === "" ? null : Number(form.warrantyMonths),
        delivery_days: form.deliveryDays.trim() === "" ? null : Number(form.deliveryDays),
      },
      { onSuccess: close },
    );
  }

  return (
    <div className="space-y-5">
      <PanelToolbar>
        <Input
          type="search"
          aria-label="Mahsulot qidirish"
          placeholder="Nomi yoki OEM raqami"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full sm:w-64"
        />
        <Select
          aria-label="Holat bo'yicha saralash"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "OUT_OF_STOCK")
          }
          className="w-full sm:w-40"
        >
          <option value="ALL">Hammasi</option>
          <option value="ACTIVE">Faol</option>
          <option value="OUT_OF_STOCK">Tugagan</option>
        </Select>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <ExportButton path={`/export/seller/${sellerId}/stock`} label="Qoldiqlarni Excelga" />
          <Button size="sm" onClick={() => open(BLANK_FORM)}>
            Narx va qoldiq
          </Button>
        </span>
      </PanelToolbar>

      <p className="type-caption">
        Katalogga butunlay yangi mahsulot qo'shish moderatsiyadan o'tadi; narx va qoldiq esa
        saqlanishi bilan darhol kuchga kiradi.
      </p>

      <PanelSection>
        {offers.isPending ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }, (_, index) => (
              <LineSkeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : offers.isError ? (
          <div className="p-5">
            <ErrorState error={offers.error} onRetry={() => void offers.refetch()} compact />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Hali mahsulot yo'q"
            subtitle="Katalogdan mahsulot tanlab, o'z narxingiz va qoldig'ingizni qo'ying."
          />
        ) : (
          <DataTable
            head={["Rasm", "Mahsulot", "Kategoriya", "Narx", "Qoldiq", "Holat", "Amal"]}
            empty={<p className="type-caption">Bu shartlarga mos mahsulot topilmadi.</p>}
          >
            {visible.map((row) => (
              <Row key={row.offer_id}>
                <Cell>
                  {row.image_url ? (
                    <img
                      src={row.image_url}
                      alt=""
                      width={32}
                      height={32}
                      loading="lazy"
                      className="size-8 object-cover"
                    />
                  ) : (
                    <span className="block size-8 bg-muted" aria-hidden />
                  )}
                </Cell>
                <Cell>
                  <span className="block max-w-[16rem] truncate font-medium">
                    {row.product_name}
                  </span>
                  {row.oem_number && <span className="type-caption block">{row.oem_number}</span>}
                </Cell>
                <Cell className="whitespace-nowrap">{row.category_name ?? "—"}</Cell>
                <Cell numeric className="whitespace-nowrap">
                  {formatSom(row.price)}
                  {row.old_price && (
                    <span className="type-caption ml-2 line-through">
                      {formatSom(row.old_price)}
                    </span>
                  )}
                </Cell>
                <Cell numeric className="whitespace-nowrap">
                  {groupDigits(row.available)} / {groupDigits(row.stock)}
                </Cell>
                <Cell>
                  <Pill tone={offerTone(row.status)}>{OFFER_STATUS_UZ[row.status]}</Pill>
                </Cell>
                <Cell>
                  <Button size="sm" variant="outline" onClick={() => open(formFrom(row, true))}>
                    Tahrirlash
                  </Button>
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </PanelSection>

      <Panel open={form !== null} title="Narx va qoldiq" onClose={close}>
        {form && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {form.locked ? (
              <Field label="Mahsulot">
                <Input value={form.productName} readOnly aria-readonly />
              </Field>
            ) : (
              <Field label="Mahsulot" error={touched ? productError : undefined}>
                <Select
                  value={form.productId}
                  onChange={(event) => {
                    const picked = rows.find((row) => row.product_id === event.target.value);
                    setForm(picked ? formFrom(picked, false) : { ...form, productId: "" });
                  }}
                >
                  <option value="">Tanlang</option>
                  {rows.map((row) => (
                    <option key={row.offer_id} value={row.product_id}>
                      {row.product_name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Narx (so'm)" error={touched ? priceError : undefined}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={1000}
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                />
              </Field>
              <Field label="Eski narx (ixtiyoriy)" hint="Chegirmani ko'rsatish uchun">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={1000}
                  value={form.oldPrice}
                  onChange={(event) => setForm({ ...form, oldPrice: event.target.value })}
                />
              </Field>
              <Field label="Qoldiq (dona)" error={touched ? stockError : undefined}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={form.stock}
                  onChange={(event) => setForm({ ...form, stock: event.target.value })}
                />
              </Field>
              <Field label="Holat">
                <Select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as OfferStatus })
                  }
                >
                  {EDITABLE_STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kafolat (oy)">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={form.warrantyMonths}
                  onChange={(event) => setForm({ ...form, warrantyMonths: event.target.value })}
                />
              </Field>
              <Field label="Yetkazish kunlari">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={form.deliveryDays}
                  onChange={(event) => setForm({ ...form, deliveryDays: event.target.value })}
                />
              </Field>
            </div>

            {upsert.isError && (
              <p role="alert" className="text-sm text-destructive">
                {upsert.error.message}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={close} disabled={upsert.isPending}>
                Bekor qilish
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? "Saqlanmoqda…" : "Saqlash"}
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
