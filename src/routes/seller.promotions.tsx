/**
 * Aksiyalar — discounts, which are deliberately not prices.
 *
 * A promotion never rewrites the catalogue price. It is evaluated in the basket
 * at checkout, against the lines that match its scope, which is what lets a shop
 * start and stop a campaign in the middle of a day without republishing a single
 * listing — and what lets the same product carry a shop-wide discount and a
 * promo code at once without the two fighting over one number.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { num } from "@/components/avtoqism/panel/Charts";
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
  inputClass,
} from "@/components/avtoqism/panel/Widgets";
import type { PromotionKind, PromotionOut, PromotionScope } from "@/lib/api/types";
import { formatDate, formatSom, groupDigits } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useCategories } from "@/lib/query/catalog";
import {
  useCreatePromotion,
  usePromotions,
  useSellerOffers,
  useTogglePromotion,
  useUpdatePromotion,
} from "@/lib/query/seller";

export const Route = createFileRoute("/seller/promotions")({
  head: () => ({
    meta: [{ title: "Aksiyalar — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: SellerPromotions,
});

const KIND_UZ: Record<string, string> = {
  PERCENT: "Foizli",
  FIXED: "Belgilangan summa",
  FREE_DELIVERY: "Bepul yetkazish",
};

const SCOPE_UZ: Record<string, string> = {
  PRODUCT: "Mahsulot",
  CATEGORY: "Kategoriya",
  SELLER: "Butun do'kon",
};

const KINDS: PromotionKind[] = ["PERCENT", "FIXED", "FREE_DELIVERY"];
const SCOPES: PromotionScope[] = ["PRODUCT", "CATEGORY", "SELLER"];

function valueLabel(promotion: PromotionOut): string {
  if (promotion.kind === "FREE_DELIVERY") return "—";
  if (promotion.kind === "PERCENT") return `${num(promotion.value)}%`;
  return formatSom(promotion.value);
}

/**
 * "Now" is read after mount, never during render: the server and the browser
 * would not agree on it, and a status that flips between the two is a hydration
 * mismatch. Until it is known, only the on/off flag is shown.
 */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  return now;
}

function statusOf(
  promotion: PromotionOut,
  now: number | null,
): { label: string; tone: "good" | "warning" | "neutral" | "info" } {
  if (!promotion.is_active) return { label: "To'xtatilgan", tone: "neutral" };
  if (now === null) return { label: "Faol", tone: "good" };
  if (now < new Date(promotion.starts_at).getTime()) {
    return { label: "Rejalashtirilgan", tone: "info" };
  }
  if (now > new Date(promotion.ends_at).getTime()) return { label: "Tugagan", tone: "neutral" };
  return { label: "Faol", tone: "good" };
}

/** ISO -> the value a `datetime-local` input wants, in the viewer's own clock. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* --- screen --------------------------------------------------------------------- */
function SellerPromotions() {
  const sellerId = useSellerId();
  const { lang } = useLang();
  const now = useNow();

  const promotions = usePromotions(sellerId);
  const toggle = useTogglePromotion(sellerId);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionOut | null>(null);

  return (
    <div className="space-y-5">
      <PanelToolbar>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Aksiya e'lon qilish
        </Button>
        <span className="ml-auto">
          <ExportButton path={`/export/seller/${sellerId}/promotions`} />
        </span>
      </PanelToolbar>

      <p className="border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
        Chegirma katalogdagi narxni o'zgartirmaydi — u savatda qo'llanadi. Shuning uchun aksiyani
        istalgan payt boshlash yoki to'xtatish mumkin, e'lonlarga tegmasdan.
      </p>

      <PanelSection>
        {promotions.isPending ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <LineSkeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : promotions.isError ? (
          <div className="p-5">
            <ErrorState
              error={promotions.error}
              onRetry={() => void promotions.refetch()}
              compact
            />
          </div>
        ) : (
          <DataTable
            head={[
              "Nomi",
              "Turi",
              "Qiymat",
              "Qamrov",
              "Promokod",
              "Muddat",
              "Foydalanildi",
              "Holat",
              "Amal",
            ]}
            empty={
              <p className="type-caption">
                Hali aksiya yo'q. Birinchi chegirmani e'lon qiling — u savatda avtomatik ishlaydi.
              </p>
            }
          >
            {promotions.data.map((promotion) => {
              const status = statusOf(promotion, now);
              const busy = toggle.isPending && toggle.variables?.promotionId === promotion.id;
              const failure =
                toggle.isError && toggle.variables?.promotionId === promotion.id
                  ? toggle.error.message
                  : null;
              return (
                <Row key={promotion.id}>
                  <Cell>
                    <span className="block max-w-[14rem] truncate font-medium">
                      {promotion.title_uz}
                    </span>
                  </Cell>
                  <Cell className="whitespace-nowrap">
                    {KIND_UZ[promotion.kind] ?? promotion.kind}
                  </Cell>
                  <Cell numeric className="whitespace-nowrap">
                    {valueLabel(promotion)}
                  </Cell>
                  <Cell className="whitespace-nowrap">
                    {SCOPE_UZ[promotion.scope] ?? promotion.scope}
                  </Cell>
                  <Cell className="whitespace-nowrap">
                    {promotion.code ? (
                      <span className="font-mono text-xs font-semibold">{promotion.code}</span>
                    ) : (
                      <span className="type-caption">Avtomatik</span>
                    )}
                  </Cell>
                  <Cell className="whitespace-nowrap">
                    {formatDate(promotion.starts_at, lang)}–{formatDate(promotion.ends_at, lang)}
                  </Cell>
                  <Cell numeric className="whitespace-nowrap">
                    {groupDigits(promotion.used_count)} /{" "}
                    {promotion.usage_limit == null ? "∞" : groupDigits(promotion.usage_limit)}
                  </Cell>
                  <Cell>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </Cell>
                  <Cell>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          toggle.mutate({
                            promotionId: promotion.id,
                            active: !promotion.is_active,
                          })
                        }
                      >
                        {promotion.is_active ? "To'xtatish" : "Davom ettirish"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(promotion)}>
                        Tahrirlash
                      </Button>
                    </div>
                    {failure && <p className="mt-1.5 text-xs text-destructive">{failure}</p>}
                  </Cell>
                </Row>
              );
            })}
          </DataTable>
        )}
      </PanelSection>

      <Panel open={createOpen} title="Yangi aksiya" onClose={() => setCreateOpen(false)}>
        {createOpen && <CreateForm sellerId={sellerId} onDone={() => setCreateOpen(false)} />}
      </Panel>

      <Panel open={editing !== null} title="Aksiyani tahrirlash" onClose={() => setEditing(null)}>
        {editing && (
          <EditForm sellerId={sellerId} promotion={editing} onDone={() => setEditing(null)} />
        )}
      </Panel>
    </div>
  );
}

/* --- create ---------------------------------------------------------------------- */
function CreateForm({ sellerId, onDone }: { sellerId: string; onDone: () => void }) {
  const create = useCreatePromotion(sellerId);
  const offers = useSellerOffers(sellerId);
  const categories = useCategories();

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<PromotionKind>("PERCENT");
  const [scope, setScope] = useState<PromotionScope>("SELLER");
  const [value, setValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [code, setCode] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [perUser, setPerUser] = useState("1");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  const needsValue = kind !== "FREE_DELIVERY";
  const numericValue = Number(value);

  const targetsChosen =
    scope === "SELLER" ||
    (scope === "PRODUCT" && productIds.length > 0) ||
    (scope === "CATEGORY" && categoryIds.length > 0);

  const valid =
    title.trim() !== "" &&
    startsAt !== "" &&
    endsAt !== "" &&
    targetsChosen &&
    (!needsValue || (Number.isFinite(numericValue) && numericValue > 0)) &&
    (kind !== "PERCENT" || numericValue <= 100);

  const productOptions = useMemo(
    () =>
      (offers.data ?? []).map((offer) => ({
        id: offer.product_id,
        label: offer.product_name,
      })),
    [offers.data],
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    create.mutate(
      {
        title_uz: title.trim(),
        kind,
        scope,
        value: needsValue ? numericValue : 0,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        product_ids: scope === "PRODUCT" ? productIds : [],
        category_ids: scope === "CATEGORY" ? categoryIds : [],
        code: code.trim() || null,
        max_discount: maxDiscount.trim() === "" ? null : Number(maxDiscount),
        min_order_amount: minOrder.trim() === "" ? null : Number(minOrder),
        usage_limit: usageLimit.trim() === "" ? null : Number(usageLimit),
        usage_limit_per_user: perUser.trim() === "" ? null : Number(perUser),
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field label="Nomi" hint="Xaridor savatda shu nomni ko'radi.">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Turi">
          <Select value={kind} onChange={(event) => setKind(event.target.value as PromotionKind)}>
            {KINDS.map((option) => (
              <option key={option} value={option}>
                {KIND_UZ[option] ?? option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Qamrov">
          <Select
            value={scope}
            onChange={(event) => setScope(event.target.value as PromotionScope)}
          >
            {SCOPES.map((option) => (
              <option key={option} value={option}>
                {SCOPE_UZ[option] ?? option}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {needsValue && (
        <Field
          label={kind === "PERCENT" ? "Chegirma foizi" : "Chegirma summasi"}
          hint={kind === "PERCENT" ? "1 dan 100 gacha." : "So'mda."}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={kind === "PERCENT" ? 100 : undefined}
              step={kind === "PERCENT" ? 1 : 1000}
              inputMode="numeric"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              required
            />
            <span className="type-label shrink-0 text-muted-foreground">
              {kind === "PERCENT" ? "%" : "so'm"}
            </span>
          </div>
        </Field>
      )}

      {scope === "PRODUCT" && (
        <Field
          label="Mahsulotlar"
          hint="Bir nechtasini tanlash uchun Ctrl (Mac'da ⌘) tugmasini bosib turing."
        >
          {offers.isPending ? (
            <LineSkeleton className="h-24 w-full" />
          ) : offers.isError ? (
            <ErrorState error={offers.error} onRetry={() => void offers.refetch()} compact />
          ) : (
            <select
              multiple
              size={6}
              className={inputClass}
              value={productIds}
              onChange={(event) =>
                setProductIds(Array.from(event.target.selectedOptions, (option) => option.value))
              }
            >
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      {scope === "CATEGORY" && (
        <Field
          label="Kategoriyalar"
          hint="Bir nechtasini tanlash uchun Ctrl (Mac'da ⌘) tugmasini bosib turing."
        >
          {categories.isPending ? (
            <LineSkeleton className="h-24 w-full" />
          ) : categories.isError ? (
            <ErrorState
              error={categories.error}
              onRetry={() => void categories.refetch()}
              compact
            />
          ) : (
            <select
              multiple
              size={6}
              className={inputClass}
              value={categoryIds}
              onChange={(event) =>
                setCategoryIds(Array.from(event.target.selectedOptions, (option) => option.value))
              }
            >
              {categories.data.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name_uz}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Eng ko'p chegirma" hint="Ixtiyoriy. Foizli chegirmani cheklaydi.">
          <Input
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            value={maxDiscount}
            onChange={(event) => setMaxDiscount(event.target.value)}
          />
        </Field>
        <Field label="Eng kam buyurtma summasi" hint="Ixtiyoriy.">
          <Input
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            value={minOrder}
            onChange={(event) => setMinOrder(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Boshlanish">
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
        </Field>
        <Field label="Tugash">
          <Input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            required
          />
        </Field>
      </div>

      <Field
        label="Promokod"
        hint="Ixtiyoriy. Bo'sh qoldirsangiz, chegirma savatda o'zi qo'llanadi — kod kiritish shart emas."
      >
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          maxLength={32}
          placeholder="BAHOR25"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Umumiy limit" hint="Ixtiyoriy. Bo'sh — cheklanmagan.">
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={usageLimit}
            onChange={(event) => setUsageLimit(event.target.value)}
          />
        </Field>
        <Field label="Bir mijozga limit">
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={perUser}
            onChange={(event) => setPerUser(event.target.value)}
          />
        </Field>
      </div>

      {!targetsChosen && (
        <p className="text-sm text-destructive">
          {scope === "PRODUCT"
            ? "Kamida bitta mahsulot tanlang."
            : "Kamida bitta kategoriya tanlang."}
        </p>
      )}
      {create.isError && <p className="text-sm text-destructive">{create.error.message}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || create.isPending}>
          {create.isPending ? "Saqlanmoqda…" : "E'lon qilish"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}

/* --- edit ------------------------------------------------------------------------ */
/**
 * Only the fields the PATCH endpoint accepts. Kind, scope, code and the targets
 * are fixed once a promotion exists — changing them mid-flight would rewrite
 * discounts that people have already been shown.
 */
function EditForm({
  sellerId,
  promotion,
  onDone,
}: {
  sellerId: string;
  promotion: PromotionOut;
  onDone: () => void;
}) {
  const update = useUpdatePromotion(sellerId);

  const [title, setTitle] = useState(promotion.title_uz);
  const [value, setValue] = useState(String(num(promotion.value)));
  const [maxDiscount, setMaxDiscount] = useState(
    promotion.max_discount == null ? "" : String(num(promotion.max_discount)),
  );
  const [minOrder, setMinOrder] = useState(
    promotion.min_order_amount == null ? "" : String(num(promotion.min_order_amount)),
  );
  const [startsAt, setStartsAt] = useState(() => toLocalInput(promotion.starts_at));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(promotion.ends_at));
  const [usageLimit, setUsageLimit] = useState(
    promotion.usage_limit == null ? "" : String(promotion.usage_limit),
  );
  const [perUser, setPerUser] = useState(
    promotion.usage_limit_per_user == null ? "" : String(promotion.usage_limit_per_user),
  );

  const needsValue = promotion.kind !== "FREE_DELIVERY";
  const numericValue = Number(value);
  const valid =
    title.trim() !== "" &&
    startsAt !== "" &&
    endsAt !== "" &&
    (!needsValue || (Number.isFinite(numericValue) && numericValue > 0));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    update.mutate(
      {
        promotionId: promotion.id,
        title_uz: title.trim(),
        value: needsValue ? numericValue : 0,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        max_discount: maxDiscount.trim() === "" ? null : Number(maxDiscount),
        min_order_amount: minOrder.trim() === "" ? null : Number(minOrder),
        usage_limit: usageLimit.trim() === "" ? null : Number(usageLimit),
        usage_limit_per_user: perUser.trim() === "" ? null : Number(perUser),
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <p className="type-caption">
        Turi ({KIND_UZ[promotion.kind] ?? promotion.kind}), qamrovi (
        {SCOPE_UZ[promotion.scope] ?? promotion.scope}) va promokodi o'zgarmaydi.
      </p>

      <Field label="Nomi">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          required
        />
      </Field>

      {needsValue && (
        <Field label={promotion.kind === "PERCENT" ? "Chegirma foizi" : "Chegirma summasi"}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={promotion.kind === "PERCENT" ? 100 : undefined}
              step={promotion.kind === "PERCENT" ? 1 : 1000}
              inputMode="numeric"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              required
            />
            <span className="type-label shrink-0 text-muted-foreground">
              {promotion.kind === "PERCENT" ? "%" : "so'm"}
            </span>
          </div>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Eng ko'p chegirma">
          <Input
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            value={maxDiscount}
            onChange={(event) => setMaxDiscount(event.target.value)}
          />
        </Field>
        <Field label="Eng kam buyurtma summasi">
          <Input
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            value={minOrder}
            onChange={(event) => setMinOrder(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Boshlanish">
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
        </Field>
        <Field label="Tugash">
          <Input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Umumiy limit" hint="Bo'sh — cheklanmagan.">
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={usageLimit}
            onChange={(event) => setUsageLimit(event.target.value)}
          />
        </Field>
        <Field label="Bir mijozga limit">
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={perUser}
            onChange={(event) => setPerUser(event.target.value)}
          />
        </Field>
      </div>

      {update.isError && <p className="text-sm text-destructive">{update.error.message}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || update.isPending}>
          {update.isPending ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}
