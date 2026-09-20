/**
 * Omborlar — where a shop actually runs its stock.
 *
 * The screen is ordered the way the work is: first the branches and what each
 * one holds, then the shelf-by-shelf list with the two actions that change a
 * number (a movement and a transfer), then the history of every change that was
 * ever made. Stock is append-only by design — nothing here edits a quantity in
 * place, every correction is itself a movement with a reason attached — so the
 * history at the bottom is always the full story of how a shelf got to its
 * current count.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

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
import type { StockRowOut, WarehouseOut, WarehouseSummaryOut } from "@/lib/api/types";
import { formatDateTime, formatSom, groupDigits } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import {
  useAdjustStock,
  useCreateWarehouse,
  useMakeDefaultWarehouse,
  useMovements,
  useStock,
  useTransferStock,
  useUpdateWarehouse,
  useWarehouseSummary,
  useWarehouses,
} from "@/lib/query/seller";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/warehouses")({
  head: () => ({
    meta: [{ title: "Omborlar — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: SellerWarehouses,
});

/* --- labels ---------------------------------------------------------------- */
const MOVEMENT_KIND_UZ: Record<string, string> = {
  INBOUND: "Kirim",
  SALE: "Sotuv",
  RETURN: "Qaytarish",
  ADJUSTMENT: "Tuzatish",
  LOSS: "Yo'qotish",
  TRANSFER_OUT: "Chiqim (ko'chirish)",
  TRANSFER_IN: "Kirim (ko'chirish)",
};

/** The kinds a seller may create by hand. SALE and the transfer pair are ours. */
const MANUAL_KINDS = ["INBOUND", "RETURN", "ADJUSTMENT", "LOSS"] as const;
type ManualKind = (typeof MANUAL_KINDS)[number];

const MANUAL_KIND_UZ: Record<ManualKind, string> = {
  INBOUND: "Kirim",
  RETURN: "Qaytarildi",
  ADJUSTMENT: "Tuzatish",
  LOSS: "Yo'qotish",
};

function movementLabel(kind: string): string {
  return MOVEMENT_KIND_UZ[kind] ?? kind;
}

/* --- screen ----------------------------------------------------------------- */
function SellerWarehouses() {
  const sellerId = useSellerId();
  const { lang } = useLang();

  const summary = useWarehouseSummary(sellerId);
  const warehouses = useWarehouses(sellerId);
  const [branch, setBranch] = useState<string>("ALL");
  const stock = useStock(sellerId, branch === "ALL" ? null : branch);

  const makeDefault = useMakeDefaultWarehouse(sellerId);

  const [adjustRow, setAdjustRow] = useState<StockRowOut | null>(null);
  const [transferRow, setTransferRow] = useState<StockRowOut | null>(null);
  const [warehouseForm, setWarehouseForm] = useState<
    { mode: "create" } | { mode: "edit"; warehouse: WarehouseOut } | null
  >(null);

  const branches = useMemo(() => warehouses.data ?? [], [warehouses.data]);
  const stockRows = stock.data ?? [];

  return (
    <div className="space-y-6">
      <PanelToolbar>
        <Button onClick={() => setWarehouseForm({ mode: "create" })}>
          <Plus className="size-4" aria-hidden />
          Ombor qo'shish
        </Button>
        <span className="ml-auto flex flex-wrap items-start gap-2">
          <ExportButton path={`/export/seller/${sellerId}/stock`} label="Qoldiqlarni Excelga" />
          <ExportButton
            path={`/export/seller/${sellerId}/movements`}
            label="Harakatlarni Excelga"
          />
        </span>
      </PanelToolbar>

      {/* --- branches --- */}
      {summary.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="border border-border bg-card p-5">
              <LineSkeleton className="mb-4 h-5 w-40" />
              <LineSkeleton className="mb-2 h-3 w-28" />
              <LineSkeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} compact />
      ) : summary.data.length === 0 ? (
        <EmptyState
          title="Hali ombor yo'q"
          subtitle="Birinchi omborni oching — mahsulot qoldiqlari shu omborlarda saqlanadi."
          action={
            <Button onClick={() => setWarehouseForm({ mode: "create" })}>
              <Plus className="size-4" aria-hidden />
              Ombor qo'shish
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summary.data.map((card) => (
            <BranchCard
              key={card.warehouse.id}
              card={card}
              busy={makeDefault.isPending && makeDefault.variables === card.warehouse.id}
              error={
                makeDefault.isError && makeDefault.variables === card.warehouse.id
                  ? makeDefault.error.message
                  : null
              }
              onMakeDefault={() => makeDefault.mutate(card.warehouse.id)}
              onEdit={() => setWarehouseForm({ mode: "edit", warehouse: card.warehouse })}
            />
          ))}
        </div>
      )}

      {/* --- stock --- */}
      <PanelSection
        title="Qoldiqlar"
        subtitle="Har bir mahsulotning har bir ombordagi holati."
        action={
          <label className="flex items-center gap-2">
            <span className="type-label text-muted-foreground">Filial</span>
            <Select
              aria-label="Filial bo'yicha saralash"
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              className="w-44"
            >
              <option value="ALL">Hammasi</option>
              {branches.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </label>
        }
      >
        {stock.isPending ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }, (_, index) => (
              <LineSkeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : stock.isError ? (
          <div className="p-5">
            <ErrorState error={stock.error} onRetry={() => void stock.refetch()} compact />
          </div>
        ) : (
          <DataTable
            head={[
              "Ombor",
              "Mahsulot",
              "Qoldiq",
              "Zaxirada",
              "Mavjud",
              "Ogohlantirish chegarasi",
              "Joylashuv",
              "Narx",
              "Tannarx",
              "Amal",
            ]}
            empty={
              <p className="type-caption">
                Bu filialda qoldiq yo'q. Mahsulot qo'shib, kirim qiling.
              </p>
            }
          >
            {stockRows.map((row) => (
              <Row key={row.inventory_item_id}>
                <Cell className="whitespace-nowrap">{row.warehouse_name}</Cell>
                <Cell>
                  <span className="block max-w-[16rem] truncate font-medium">
                    {row.product_name}
                  </span>
                  {row.oem_number && (
                    <span className="type-caption block">OEM: {row.oem_number}</span>
                  )}
                </Cell>
                <Cell numeric>{groupDigits(row.quantity)}</Cell>
                <Cell numeric>{groupDigits(row.reserved)}</Cell>
                <Cell numeric>
                  <span className="inline-flex items-center justify-end gap-2">
                    {groupDigits(row.available)}
                    {row.is_low && <Pill tone="warning">Kam qoldi</Pill>}
                  </span>
                </Cell>
                <Cell numeric>
                  {row.low_stock_threshold == null ? "—" : groupDigits(row.low_stock_threshold)}
                </Cell>
                <Cell className="whitespace-nowrap">{row.bin_location ?? "—"}</Cell>
                <Cell numeric className="whitespace-nowrap">
                  {formatSom(row.price)}
                </Cell>
                <Cell numeric className="whitespace-nowrap">
                  {row.cost_price == null ? "—" : formatSom(row.cost_price)}
                </Cell>
                <Cell>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setAdjustRow(row)}>
                      Kirim/Chiqim
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={branches.length < 2}
                      onClick={() => setTransferRow(row)}
                    >
                      Ko'chirish
                    </Button>
                  </div>
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </PanelSection>

      <MovementHistory sellerId={sellerId} warehouses={branches} lang={lang} />

      <Panel open={adjustRow !== null} title="Kirim / Chiqim" onClose={() => setAdjustRow(null)}>
        {adjustRow && (
          <AdjustForm sellerId={sellerId} row={adjustRow} onDone={() => setAdjustRow(null)} />
        )}
      </Panel>

      <Panel open={transferRow !== null} title="Ko'chirish" onClose={() => setTransferRow(null)}>
        {transferRow && (
          <TransferForm
            sellerId={sellerId}
            row={transferRow}
            warehouses={branches}
            onDone={() => setTransferRow(null)}
          />
        )}
      </Panel>

      <Panel
        open={warehouseForm !== null}
        title={warehouseForm?.mode === "edit" ? "Omborni tahrirlash" : "Yangi ombor"}
        onClose={() => setWarehouseForm(null)}
      >
        {warehouseForm && (
          <WarehouseForm
            sellerId={sellerId}
            warehouse={warehouseForm.mode === "edit" ? warehouseForm.warehouse : null}
            onDone={() => setWarehouseForm(null)}
          />
        )}
      </Panel>
    </div>
  );
}

/* --- branch card ------------------------------------------------------------- */
function BranchCard({
  card,
  busy,
  error,
  onMakeDefault,
  onEdit,
}: {
  card: WarehouseSummaryOut;
  busy: boolean;
  error: string | null;
  onMakeDefault: () => void;
  onEdit: () => void;
}) {
  const warehouse = card.warehouse;
  const figures: { label: string; value: string }[] = [
    { label: "SKU soni", value: groupDigits(card.sku_count) },
    { label: "Qoldiq", value: `${groupDigits(card.units)} dona` },
    { label: "Zaxirada", value: `${groupDigits(card.reserved)} dona` },
    { label: "Sotuv qiymati", value: formatSom(card.retail_value) },
    { label: "Tannarx", value: formatSom(card.cost_value) },
  ];

  return (
    <article className="flex flex-col border border-border bg-card p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="type-h3">{warehouse.name}</h3>
        {warehouse.is_default && <Pill tone="info">Asosiy</Pill>}
        {!warehouse.is_active && <Pill tone="critical">Faol emas</Pill>}
      </div>
      <p className="type-caption">
        {warehouse.code} · {warehouse.region}, {warehouse.district}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {figures.map((figure) => (
          <div key={figure.label} className="flex items-baseline justify-between gap-2">
            <dt className="type-caption">{figure.label}</dt>
            <dd className="font-semibold tabular-nums">{figure.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {!warehouse.is_default && (
          <Button size="sm" variant="outline" disabled={busy} onClick={onMakeDefault}>
            {busy ? "Saqlanmoqda…" : "Asosiy qilish"}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Tahrirlash
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </article>
  );
}

/* --- kirim / chiqim ----------------------------------------------------------- */
function AdjustForm({
  sellerId,
  row,
  onDone,
}: {
  sellerId: string;
  row: StockRowOut;
  onDone: () => void;
}) {
  const adjust = useAdjustStock(sellerId);
  const [kind, setKind] = useState<ManualKind>("INBOUND");
  const [direction, setDirection] = useState<"UP" | "DOWN">("UP");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const amount = Number(quantity);
  const valid = Number.isFinite(amount) && amount > 0;

  // The sign is decided here rather than typed by hand: a kirim is always
  // positive, a yo'qotish always negative, and only a tuzatish can go either
  // way — which is exactly the one case the person is asked about.
  const signed =
    kind === "LOSS" ? -amount : kind === "ADJUSTMENT" && direction === "DOWN" ? -amount : amount;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    adjust.mutate(
      {
        warehouse_id: row.warehouse_id,
        offer_id: row.offer_id,
        kind,
        delta: signed,
        note: note.trim() || null,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <p className="type-label mb-1 text-muted-foreground">Mahsulot</p>
        <p className="text-sm font-medium">{row.product_name}</p>
        <p className="type-caption">
          Hozirgi qoldiq: {groupDigits(row.quantity)} dona · mavjud {groupDigits(row.available)}
        </p>
      </div>

      <Field label="Ombor" hint="Harakat shu omborga yoziladi.">
        <Input value={row.warehouse_name} readOnly disabled />
      </Field>

      <Field label="Turi">
        <Select value={kind} onChange={(event) => setKind(event.target.value as ManualKind)}>
          {MANUAL_KINDS.map((option) => (
            <option key={option} value={option}>
              {MANUAL_KIND_UZ[option]}
            </option>
          ))}
        </Select>
      </Field>

      {kind === "ADJUSTMENT" && (
        <Field label="Yo'nalish">
          <Select
            value={direction}
            onChange={(event) => setDirection(event.target.value as "UP" | "DOWN")}
          >
            <option value="UP">Qo'shish</option>
            <option value="DOWN">Ayirish</option>
          </Select>
        </Field>
      )}

      <Field
        label="Miqdor"
        hint="Yozuv o'chirilmaydi va harakatlar tarixida ko'rinadi — xato bo'lsa, teskari yozuv qiling."
      >
        <Input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
      </Field>

      <Field label="Izoh" hint="Ixtiyoriy. Masalan: yetkazib beruvchidan qabul qilindi.">
        <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} />
      </Field>

      {valid && (
        <p className="type-caption">
          Yangi qoldiq:{" "}
          <span className="font-semibold text-foreground">
            {groupDigits(row.quantity + signed)} dona
          </span>
        </p>
      )}

      {adjust.isError && <p className="text-sm text-destructive">{adjust.error.message}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || adjust.isPending}>
          {adjust.isPending ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}

/* --- ko'chirish ---------------------------------------------------------------- */
function TransferForm({
  sellerId,
  row,
  warehouses,
  onDone,
}: {
  sellerId: string;
  row: StockRowOut;
  warehouses: WarehouseOut[];
  onDone: () => void;
}) {
  const transfer = useTransferStock(sellerId);
  const [from, setFrom] = useState(row.warehouse_id);
  const [to, setTo] = useState(
    () => warehouses.find((warehouse) => warehouse.id !== row.warehouse_id)?.id ?? "",
  );
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const amount = Number(quantity);
  const sameWarehouse = from === to;
  const valid = Number.isFinite(amount) && amount > 0 && from !== "" && to !== "" && !sameWarehouse;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    transfer.mutate(
      {
        offer_id: row.offer_id,
        from_warehouse_id: from,
        to_warehouse_id: to,
        quantity: amount,
        note: note.trim() || null,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <p className="type-label mb-1 text-muted-foreground">Mahsulot</p>
        <p className="text-sm font-medium">{row.product_name}</p>
      </div>

      <Field label="Qayerdan">
        <Select value={from} onChange={(event) => setFrom(event.target.value)}>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Qayerga"
        error={sameWarehouse ? "Ikki ombor bir xil bo'lmasligi kerak." : undefined}
      >
        <Select value={to} onChange={(event) => setTo(event.target.value)}>
          <option value="">Tanlang</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Miqdor" hint={`Chiqish omborida ${groupDigits(row.available)} dona mavjud.`}>
        <Input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
      </Field>

      <Field label="Izoh" hint="Ixtiyoriy.">
        <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} />
      </Field>

      {transfer.isError && <p className="text-sm text-destructive">{transfer.error.message}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || transfer.isPending}>
          {transfer.isPending ? "Ko'chirilmoqda…" : "Ko'chirish"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}

/* --- ombor ---------------------------------------------------------------------- */
function WarehouseForm({
  sellerId,
  warehouse,
  onDone,
}: {
  sellerId: string;
  warehouse: WarehouseOut | null;
  onDone: () => void;
}) {
  const create = useCreateWarehouse(sellerId);
  const update = useUpdateWarehouse(sellerId);
  const editing = warehouse !== null;

  const [name, setName] = useState(warehouse?.name ?? "");
  const [code, setCode] = useState(warehouse?.code ?? "");
  const [region, setRegion] = useState(warehouse?.region ?? "");
  const [district, setDistrict] = useState(warehouse?.district ?? "");
  const [address, setAddress] = useState(warehouse?.address ?? "");
  const [phone, setPhone] = useState(warehouse?.phone ?? "");
  const [allowsPickup, setAllowsPickup] = useState(warehouse?.allows_pickup ?? true);
  const [makeDefault, setMakeDefault] = useState(false);

  const pending = create.isPending || update.isPending;
  const failure = create.error?.message ?? update.error?.message ?? null;
  const valid =
    name.trim() !== "" &&
    region.trim() !== "" &&
    district.trim() !== "" &&
    (editing || code.trim() !== "");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    if (warehouse) {
      update.mutate(
        {
          warehouseId: warehouse.id,
          name: name.trim(),
          region: region.trim(),
          district: district.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          allows_pickup: allowsPickup,
        },
        { onSuccess: onDone },
      );
      return;
    }
    create.mutate(
      {
        name: name.trim(),
        code: code.trim(),
        region: region.trim(),
        district: district.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        allows_pickup: allowsPickup,
        make_default: makeDefault,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field label="Nomi">
        <Input value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>

      <Field
        label="Kodi"
        hint={editing ? "Kod ochilgandan keyin o'zgarmaydi." : "Qisqa belgi — masalan TOSH-1."}
      >
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={editing}
          required={!editing}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Viloyat">
          <Input value={region} onChange={(event) => setRegion(event.target.value)} required />
        </Field>
        <Field label="Tuman">
          <Input value={district} onChange={(event) => setDistrict(event.target.value)} required />
        </Field>
      </div>

      <Field label="Manzil">
        <Input value={address} onChange={(event) => setAddress(event.target.value)} />
      </Field>

      <Field label="Telefon">
        <Input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+998 90 123 45 67"
        />
      </Field>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[var(--color-primary)]"
          checked={allowsPickup}
          onChange={(event) => setAllowsPickup(event.target.checked)}
        />
        <span>
          Mijozlar olib ketishi mumkin
          <span className="type-caption block">
            Buyurtmani shu ombordan olib ketish taklif qilinadi.
          </span>
        </span>
      </label>

      {!editing && (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--color-primary)]"
            checked={makeDefault}
            onChange={(event) => setMakeDefault(event.target.checked)}
          />
          <span>
            Asosiy ombor
            <span className="type-caption block">Yangi mahsulotlar shu omborga bog'lanadi.</span>
          </span>
        </label>
      )}

      {failure && <p className="text-sm text-destructive">{failure}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || pending}>
          {pending ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}

/* --- harakatlar tarixi ------------------------------------------------------------ */
function MovementHistory({
  sellerId,
  warehouses,
  lang,
}: {
  sellerId: string;
  warehouses: WarehouseOut[];
  lang: "uz" | "ru";
}) {
  const [warehouseId, setWarehouseId] = useState("ALL");
  const [kind, setKind] = useState("ALL");

  const movements = useMovements(sellerId, {
    warehouse_id: warehouseId === "ALL" ? null : warehouseId,
    kind: kind === "ALL" ? null : kind,
    // A working list, not an archive: the full history downloads as Excel.
    limit: 40,
  });

  return (
    <PanelSection
      title="Harakatlar tarixi"
      subtitle="Qoldiqni o'zgartirgan har bir yozuv — sotuvlar va ko'chirishlar ham shu yerda."
      action={
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2">
            <span className="type-label text-muted-foreground">Ombor</span>
            <Select
              aria-label="Ombor bo'yicha saralash"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              className="w-40"
            >
              <option value="ALL">Hammasi</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2">
            <span className="type-label text-muted-foreground">Turi</span>
            <Select
              aria-label="Harakat turi bo'yicha saralash"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="w-44"
            >
              <option value="ALL">Hammasi</option>
              {Object.keys(MOVEMENT_KIND_UZ).map((option) => (
                <option key={option} value={option}>
                  {movementLabel(option)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      }
    >
      {movements.isPending ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 5 }, (_, index) => (
            <LineSkeleton key={index} className="h-6 w-full" />
          ))}
        </div>
      ) : movements.isError ? (
        <div className="p-5">
          <ErrorState error={movements.error} onRetry={() => void movements.refetch()} compact />
        </div>
      ) : (
        <DataTable
          head={["Sana", "Ombor", "Mahsulot", "Turi", "O'zgarish", "Qoldiq", "Izoh"]}
          empty={<p className="type-caption">Bu filtr bo'yicha harakat topilmadi.</p>}
        >
          {movements.data.map((movement) => (
            <Row key={movement.id}>
              <Cell className="whitespace-nowrap">{formatDateTime(movement.created_at, lang)}</Cell>
              <Cell className="whitespace-nowrap">{movement.warehouse_name}</Cell>
              <Cell>
                <span className="block max-w-[16rem] truncate">{movement.product_name}</span>
              </Cell>
              <Cell className="whitespace-nowrap">{movementLabel(movement.kind)}</Cell>
              <Cell
                numeric
                className={cn(
                  "whitespace-nowrap",
                  movement.delta > 0
                    ? "text-success"
                    : movement.delta < 0
                      ? "text-destructive"
                      : "",
                )}
              >
                {movement.delta > 0 ? "+" : ""}
                {groupDigits(movement.delta)}
              </Cell>
              <Cell numeric>{groupDigits(movement.balance_after)}</Cell>
              <Cell>
                <span className="type-caption block max-w-[14rem] truncate">
                  {movement.note ?? "—"}
                </span>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </PanelSection>
  );
}
