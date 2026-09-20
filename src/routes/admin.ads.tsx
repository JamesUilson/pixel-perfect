/**
 * Reklama — moderation first, everything else after.
 *
 * An advert waiting for review is the only thing on this screen that blocks
 * another person's money, so the queue is at the top and shows the creative at
 * a size someone can actually judge. A campaign is a picture with a budget: a
 * table cannot tell you whether the picture is acceptable, so the queue is
 * cards and the archive below it is a table.
 *
 * The two ad charts are deliberately two charts. Revenue is som and impressions
 * are counts; putting them on one axis would make a million impressions dwarf
 * every som the placement ever earned.
 */
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/avtoqism/Page";
import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { ChartCard, Meter, MultiLine, num } from "@/components/avtoqism/panel/Charts";
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
  RangePicker,
  Row,
  Select,
} from "@/components/avtoqism/panel/Widgets";
import type {
  AdSlot,
  BannerIn,
  BannerOut,
  CampaignOut,
  PlacementIn,
  PlacementOut,
  SellerOut,
} from "@/lib/api/types";
import { formatDate, formatSom, groupDigits } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import {
  useAdminBanners,
  useAdminCampaigns,
  useAdminPlacements,
  useAdminSellers,
  useCreateBanner,
  useDeleteBanner,
  useModerateCampaign,
  usePlatformAds,
  useSavePlacement,
  useUpdateBanner,
} from "@/lib/query/admin";

export const Route = createFileRoute("/admin/ads")({
  head: () => ({
    meta: [{ title: "Reklama — AVTOQISM" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminAds,
});

/**
 * `AdPricingModel` is not among the aliases `@/lib/api/types` re-exports, so the
 * union is spelled out here. It matches the schema exactly, which is what makes
 * it assignable to `PlacementIn["pricing_model"]`.
 */
type PricingModel = "CPM" | "CPC" | "FLAT";

const SLOT_UZ: Record<string, string> = {
  HOME_SLIDER: "Bosh sahifa slayderi",
  HOME_BANNER: "Bosh sahifa banneri",
  CATEGORY_TOP: "Kategoriya tepasi",
  SEARCH_TOP: "Qidiruv tepasi",
  PRODUCT_RELATED: "Mahsulot sahifasi",
  FEED_INTERSTITIAL: "Feed orasida",
};

const SLOTS: AdSlot[] = [
  "HOME_SLIDER",
  "HOME_BANNER",
  "CATEGORY_TOP",
  "SEARCH_TOP",
  "PRODUCT_RELATED",
  "FEED_INTERSTITIAL",
];

const CAMPAIGN_STATUS_UZ: Record<
  string,
  { label: string; tone: "neutral" | "good" | "warning" | "critical" | "info" }
> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  PENDING_REVIEW: { label: "Tekshiruvda", tone: "warning" },
  ACTIVE: { label: "Faol", tone: "good" },
  PAUSED: { label: "To'xtatilgan", tone: "neutral" },
  REJECTED: { label: "Rad etildi", tone: "critical" },
  OUT_OF_BUDGET: { label: "Byudjet tugadi", tone: "warning" },
  COMPLETED: { label: "Yakunlandi", tone: "neutral" },
};

const PRICING_UZ: Record<string, string> = {
  CPM: "1000 ko'rish uchun",
  CPC: "har bir bosish uchun",
  FLAT: "kunlik",
};

function ctrLabel(impressions: number, clicks: number): string {
  if (impressions === 0) return "—";
  return `${((clicks / impressions) * 100).toFixed(2)}%`;
}

function placementPriceValue(placement: PlacementOut): string | null {
  if (placement.pricing_model === "CPM") return placement.price_cpm ?? null;
  if (placement.pricing_model === "CPC") return placement.price_cpc ?? null;
  return placement.price_flat_daily ?? null;
}

function toIso(local: string): string | null {
  if (local.trim() === "") return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

/* --- screen --------------------------------------------------------------------- */
function AdminAds() {
  const { lang } = useLang();
  const sellers = useAdminSellers();
  const placements = useAdminPlacements();

  const placementById = useMemo(() => {
    const map = new Map<string, PlacementOut>();
    for (const placement of placements.data ?? []) map.set(placement.id, placement);
    return map;
  }, [placements.data]);

  return (
    <div className="space-y-6">
      <ModerationQueue sellers={sellers.data} placementById={placementById} lang={lang} />
      <AllCampaigns sellers={sellers.data} placementById={placementById} lang={lang} />
      <AdRevenueCharts />
      <PlacementsSection
        placements={placements.data}
        isPending={placements.isPending}
        error={placements.isError ? placements.error : null}
        onRetry={() => void placements.refetch()}
      />
      <BannersSection lang={lang} />
    </div>
  );
}

/* --- moderation ------------------------------------------------------------------- */
function ModerationQueue({
  sellers,
  placementById,
  lang,
}: {
  sellers: SellerOut[] | undefined;
  placementById: Map<string, PlacementOut>;
  lang: "uz" | "ru";
}) {
  const pending = useAdminCampaigns("PENDING_REVIEW");
  const moderate = useModerateCampaign();
  const [rejecting, setRejecting] = useState<CampaignOut | null>(null);
  const [reason, setReason] = useState("");

  const busyId = moderate.isPending ? (moderate.variables?.campaignId ?? null) : null;

  function submitRejection(event: React.FormEvent) {
    event.preventDefault();
    if (!rejecting || reason.trim().length < 3) return;
    moderate.mutate(
      { campaignId: rejecting.id, status: "REJECTED", reason: reason.trim() },
      {
        onSuccess: () => {
          setRejecting(null);
          setReason("");
        },
      },
    );
  }

  const rows = pending.data ?? [];

  return (
    <PanelSection
      title="Tekshiruvdagi kampaniyalar"
      subtitle="Sotuvchi to'lagan, lekin hali efirga chiqmagan reklamalar. Rasm va matnni ko'rib chiqing."
    >
      {moderate.isError && (
        <p className="border-b border-destructive/30 bg-destructive/8 px-5 py-3 text-sm text-destructive">
          {moderate.error.message}
        </p>
      )}

      {pending.isPending ? (
        <TableSkeleton rows={3} />
      ) : pending.isError ? (
        <div className="p-5">
          <ErrorState error={pending.error} onRetry={() => void pending.refetch()} compact />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="Navbat bo'sh"
            subtitle="Tekshiruvni kutayotgan reklama yo'q. Yangi so'rov kelganda u shu yerda paydo bo'ladi."
          />
        </div>
      ) : (
        <ul className="grid gap-px bg-border lg:grid-cols-2">
          {rows.map((campaign) => {
            const creative = campaign.creatives[0];
            const placement = placementById.get(campaign.placement_id);
            const busy = busyId === campaign.id;
            return (
              <li key={campaign.id} className="bg-card p-5">
                {creative ? (
                  <img
                    src={creative.image_url}
                    alt={creative.headline_uz}
                    className="mb-4 aspect-[3/1] w-full border border-border object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="type-caption mb-4 grid aspect-[3/1] w-full place-items-center border border-dashed border-border">
                    Kreativ yuklanmagan
                  </div>
                )}

                <h4 className="type-h3">{campaign.title}</h4>
                {creative && (
                  <p className="type-caption mt-1">
                    {creative.headline_uz}
                    {creative.subtitle_uz ? ` · ${creative.subtitle_uz}` : ""}
                  </p>
                )}

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="type-label text-muted-foreground">Do'kon</dt>
                    <dd className="mt-1">
                      {sellers?.find((seller) => seller.id === campaign.seller_id)?.store_name ??
                        campaign.seller_id.slice(0, 8)}
                    </dd>
                  </div>
                  <div>
                    <dt className="type-label text-muted-foreground">O'rin</dt>
                    <dd className="mt-1">
                      {placement ? (SLOT_UZ[placement.slot] ?? placement.slot) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="type-label text-muted-foreground">Byudjet</dt>
                    <dd className="mt-1 tabular-nums">{formatSom(num(campaign.budget))}</dd>
                  </div>
                  <div>
                    <dt className="type-label text-muted-foreground">Muddat</dt>
                    <dd className="mt-1">
                      {formatDate(campaign.starts_at, lang)}–{formatDate(campaign.ends_at, lang)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    disabled={busy}
                    onClick={() => moderate.mutate({ campaignId: campaign.id, status: "ACTIVE" })}
                  >
                    {busy ? "Yuborilmoqda…" : "Tasdiqlash"}
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      setRejecting(campaign);
                      setReason("");
                    }}
                  >
                    Rad etish
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Panel
        open={rejecting !== null}
        title="Reklamani rad etish"
        onClose={() => setRejecting(null)}
      >
        <form className="space-y-4" onSubmit={submitRejection}>
          <p className="type-caption">{rejecting?.title ?? ""}</p>
          <Field label="Sabab" hint="Sotuvchi bu matnni ko'radi va shunga qarab tuzatadi.">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Rasmda boshqa brendning logotipi bor"
              maxLength={300}
              required
            />
          </Field>
          {moderate.isError && <p className="text-sm text-destructive">{moderate.error.message}</p>}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="danger"
              disabled={reason.trim().length < 3 || moderate.isPending}
            >
              {moderate.isPending ? "Yuborilmoqda…" : "Rad etish"}
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

/* --- all campaigns ------------------------------------------------------------------ */
function AllCampaigns({
  sellers,
  placementById,
  lang,
}: {
  sellers: SellerOut[] | undefined;
  placementById: Map<string, PlacementOut>;
  lang: "uz" | "ru";
}) {
  const [status, setStatus] = useState("ALL");
  const campaigns = useAdminCampaigns(status === "ALL" ? null : status);

  return (
    <PanelSection
      title="Barcha kampaniyalar"
      subtitle="Platformadagi har bir reklama kampaniyasi va uning natijasi."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="type-label text-muted-foreground">Holat</span>
            <Select
              aria-label="Holat bo'yicha saralash"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-44"
            >
              <option value="ALL">Hammasi</option>
              {Object.keys(CAMPAIGN_STATUS_UZ).map((key) => (
                <option key={key} value={key}>
                  {CAMPAIGN_STATUS_UZ[key]?.label ?? key}
                </option>
              ))}
            </Select>
          </label>
          <ExportButton path="/export/admin/campaigns" />
        </div>
      }
    >
      {campaigns.isPending ? (
        <TableSkeleton rows={6} />
      ) : campaigns.isError ? (
        <div className="p-5">
          <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} compact />
        </div>
      ) : (
        <DataTable
          head={[
            "Kampaniya",
            "Holat",
            "Byudjet",
            "Sarflandi",
            "Ko'rishlar",
            "Bosishlar",
            "CTR",
            "Muddat",
          ]}
          empty={<p className="type-caption">Bu saralash bo'yicha kampaniya yo'q.</p>}
        >
          {campaigns.data.map((campaign) => {
            const tone = CAMPAIGN_STATUS_UZ[campaign.status] ?? {
              label: campaign.status,
              tone: "neutral" as const,
            };
            const placement = placementById.get(campaign.placement_id);
            const budget = num(campaign.budget);
            const spent = num(campaign.spent);
            return (
              <Row key={campaign.id}>
                <Cell>
                  <span className="font-semibold">{campaign.title}</span>
                  <span className="type-caption block">
                    {sellers?.find((seller) => seller.id === campaign.seller_id)?.store_name ??
                      campaign.seller_id.slice(0, 8)}
                    {placement ? ` · ${SLOT_UZ[placement.slot] ?? placement.slot}` : ""}
                  </span>
                </Cell>
                <Cell>
                  <Pill tone={tone.tone}>{tone.label}</Pill>
                </Cell>
                <Cell numeric className="whitespace-nowrap">
                  {formatSom(budget)}
                </Cell>
                <Cell className="min-w-[10rem]">
                  <span className="mb-1.5 block text-right tabular-nums">{formatSom(spent)}</span>
                  <Meter
                    value={spent}
                    max={budget}
                    tone={budget > 0 && spent >= budget ? "warning" : "neutral"}
                  />
                </Cell>
                <Cell numeric>{groupDigits(campaign.impressions)}</Cell>
                <Cell numeric>{groupDigits(campaign.clicks)}</Cell>
                <Cell numeric>{ctrLabel(campaign.impressions, campaign.clicks)}</Cell>
                <Cell className="whitespace-nowrap">
                  {formatDate(campaign.starts_at, lang)}–{formatDate(campaign.ends_at, lang)}
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      )}
    </PanelSection>
  );
}

/* --- ad revenue ---------------------------------------------------------------------- */
/**
 * The same frame both ad charts use. It lives at module scope rather than
 * inside the section, so React keeps one component identity across renders.
 */
function AdChartFrame({
  title,
  subtitle,
  action,
  isPending,
  error,
  onRetry,
  isEmpty,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  isEmpty: boolean;
  children: ReactNode;
}) {
  if (isPending || error || isEmpty) {
    return (
      <section className="border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="type-h3">{title}</h3>
            <p className="type-caption mt-1">{subtitle}</p>
          </div>
          {action}
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
  return (
    <ChartCard title={title} subtitle={subtitle} action={action}>
      {children}
    </ChartCard>
  );
}

function AdRevenueCharts() {
  const [days, setDays] = useState(30);
  const ads = usePlatformAds(days);
  const rows = ads.data ?? [];
  const error = ads.isError ? ads.error : null;
  const shared = {
    isPending: ads.isPending,
    error,
    onRetry: () => void ads.refetch(),
    isEmpty: rows.length === 0,
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <AdChartFrame
        title="Reklama daromadi"
        subtitle="Kunlik, so'mda."
        action={<RangePicker value={days} onChange={setDays} />}
        {...shared}
      >
        <MultiLine data={rows} series={[{ key: "revenue", name: "Daromad" }]} />
      </AdChartFrame>

      <AdChartFrame
        title="Ko'rishlar va bosishlar"
        subtitle="Soni — so'm bilan bir o'qda ko'rsatilmaydi."
        {...shared}
      >
        {/* Counts, so `money={false}`: the tooltip must never say "so'm" here. */}
        <MultiLine
          data={rows}
          series={[
            { key: "impressions", name: "Ko'rishlar" },
            { key: "clicks", name: "Bosishlar" },
          ]}
          money={false}
        />
      </AdChartFrame>
    </div>
  );
}

/* --- placements ------------------------------------------------------------------------ */
function PlacementsSection({
  placements,
  isPending,
  error,
  onRetry,
}: {
  placements: PlacementOut[] | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const [editing, setEditing] = useState<PlacementOut | null>(null);

  return (
    <PanelSection
      title="Reklama o'rinlari va narxlar"
      subtitle="Sotuvchilar shu narxlarda reklama sotib oladi. O'zgarish yangi kampaniyalarga qo'llanadi."
    >
      {isPending ? (
        <TableSkeleton />
      ) : error ? (
        <div className="p-5">
          <ErrorState error={error} onRetry={onRetry} compact />
        </div>
      ) : (
        <DataTable
          head={["O'rin", "Model", "Narx", "Eng kam byudjet", "Bir vaqtda", "Faol", ""]}
          empty={<p className="type-caption">Reklama o'rinlari sozlanmagan.</p>}
        >
          {(placements ?? []).map((placement) => {
            const price = placementPriceValue(placement);
            return (
              <Row key={placement.id}>
                <Cell>
                  <span className="font-semibold">{SLOT_UZ[placement.slot] ?? placement.slot}</span>
                  <span className="type-caption block">{placement.name_uz}</span>
                </Cell>
                <Cell className="whitespace-nowrap">{placement.pricing_model}</Cell>
                <Cell numeric className="whitespace-nowrap">
                  {price == null ? "—" : formatSom(num(price))}
                  <span className="type-caption block font-normal">
                    {PRICING_UZ[placement.pricing_model] ?? ""}
                  </span>
                </Cell>
                <Cell numeric className="whitespace-nowrap">
                  {formatSom(num(placement.min_budget))}
                </Cell>
                <Cell numeric>{groupDigits(placement.max_active)}</Cell>
                <Cell>
                  <Pill tone={placement.is_active ? "good" : "neutral"}>
                    {placement.is_active ? "Faol" : "O'chiq"}
                  </Pill>
                </Cell>
                <Cell>
                  <Button size="sm" variant="outline" onClick={() => setEditing(placement)}>
                    Tahrirlash
                  </Button>
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      )}

      <Panel
        open={editing !== null}
        title={editing ? (SLOT_UZ[editing.slot] ?? editing.slot) : "O'rin"}
        onClose={() => setEditing(null)}
      >
        {editing && <PlacementForm placement={editing} onDone={() => setEditing(null)} />}
      </Panel>
    </PanelSection>
  );
}

function PlacementForm({ placement, onDone }: { placement: PlacementOut; onDone: () => void }) {
  const save = useSavePlacement();
  const [model, setModel] = useState<PricingModel>(placement.pricing_model);
  const [price, setPrice] = useState(() => placementPriceValue(placement) ?? "");
  const [minBudget, setMinBudget] = useState(placement.min_budget);
  const [maxActive, setMaxActive] = useState(String(placement.max_active));
  const [isActive, setIsActive] = useState(placement.is_active);

  const priceValue = Number(price);
  const minValue = Number(minBudget);
  const maxActiveValue = Number(maxActive);
  const valid =
    Number.isFinite(priceValue) &&
    priceValue >= 0 &&
    Number.isFinite(minValue) &&
    minValue >= 0 &&
    Number.isFinite(maxActiveValue) &&
    maxActiveValue >= 1;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    // Only the price for the chosen model is replaced; the other two keep what
    // they already held, so switching model and back does not erase a price.
    const input: PlacementIn = {
      slot: placement.slot,
      pricing_model: model,
      price_cpm: model === "CPM" ? priceValue : (placement.price_cpm ?? null),
      price_cpc: model === "CPC" ? priceValue : (placement.price_cpc ?? null),
      price_flat_daily: model === "FLAT" ? priceValue : (placement.price_flat_daily ?? null),
      min_budget: minValue,
      max_active: maxActiveValue,
      is_active: isActive,
    };
    save.mutate(input, { onSuccess: onDone });
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field label="Model" hint="Narx nima uchun olinishini belgilaydi.">
        <Select value={model} onChange={(event) => setModel(event.target.value as PricingModel)}>
          <option value="CPM">CPM — 1000 ko'rish uchun</option>
          <option value="CPC">CPC — har bir bosish uchun</option>
          <option value="FLAT">FLAT — kunlik belgilangan narx</option>
        </Select>
      </Field>

      <Field label="Narx" hint={PRICING_UZ[model] ?? ""}>
        <Input
          type="number"
          min={0}
          step={100}
          inputMode="numeric"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Eng kam byudjet">
          <Input
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            value={minBudget}
            onChange={(event) => setMinBudget(event.target.value)}
            required
          />
        </Field>
        <Field label="Bir vaqtda" hint="Shu o'rinda bir vaqtning o'zida nechta reklama aylanadi.">
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={maxActive}
            onChange={(event) => setMaxActive(event.target.value)}
            required
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[var(--color-primary)]"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        <span>
          Faol
          <span className="type-caption block">
            O'chirilsa, sotuvchilar bu o'rinni yangi kampaniya uchun tanlay olmaydi.
          </span>
        </span>
      </label>

      {save.isError && <p className="text-sm text-destructive">{save.error.message}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || save.isPending}>
          {save.isPending ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Bekor qilish
        </Button>
      </div>
    </form>
  );
}

/* --- house banners --------------------------------------------------------------------- */
function BannersSection({ lang }: { lang: "uz" | "ru" }) {
  const banners = useAdminBanners();
  const update = useUpdateBanner();
  const remove = useDeleteBanner();
  const [createOpen, setCreateOpen] = useState(false);

  const rows = [...(banners.data ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <PanelSection
      title="O'z bannerlarimiz"
      subtitle="Platformaning o'z reklamasi — bepul va pullik kampaniyalar bilan bir xil o'rinlarda aylanadi."
      action={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden /> Banner qo'shish
        </Button>
      }
    >
      {(update.isError || remove.isError) && (
        <p className="border-b border-destructive/30 bg-destructive/8 px-5 py-3 text-sm text-destructive">
          {update.error?.message ?? remove.error?.message}
        </p>
      )}

      {banners.isPending ? (
        <TableSkeleton rows={3} />
      ) : banners.isError ? (
        <div className="p-5">
          <ErrorState error={banners.error} onRetry={() => void banners.refetch()} compact />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="Banner yo'q"
            subtitle="O'z bannerlaringiz bo'sh reklama o'rinlarini to'ldiradi va hech narsa turmaydi."
          />
        </div>
      ) : (
        <ul className="grid gap-px bg-border lg:grid-cols-2">
          {rows.map((banner) => (
            <BannerCard
              key={banner.id}
              banner={banner}
              lang={lang}
              onToggle={() => update.mutate({ bannerId: banner.id, is_active: !banner.is_active })}
              onDelete={() => remove.mutate(banner.id)}
              busy={
                (update.isPending && update.variables?.bannerId === banner.id) ||
                (remove.isPending && remove.variables === banner.id)
              }
            />
          ))}
        </ul>
      )}

      <Panel open={createOpen} title="Yangi banner" onClose={() => setCreateOpen(false)}>
        {createOpen && <BannerForm onDone={() => setCreateOpen(false)} />}
      </Panel>
    </PanelSection>
  );
}

function BannerCard({
  banner,
  lang,
  onToggle,
  onDelete,
  busy,
}: {
  banner: BannerOut;
  lang: "uz" | "ru";
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <li className="bg-card p-5">
      <img
        src={banner.image_url}
        alt={banner.headline_uz}
        className="mb-4 aspect-[3/1] w-full border border-border object-cover"
        loading="lazy"
      />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="type-h3 truncate">{banner.headline_uz}</h4>
          <p className="type-caption mt-1">
            {SLOT_UZ[banner.slot] ?? banner.slot} · {banner.sort_order}-tartib
          </p>
        </div>
        <Pill tone={banner.is_active ? "good" : "neutral"}>
          {banner.is_active ? "Faol" : "O'chiq"}
        </Pill>
      </div>

      <p className="type-caption mt-3">
        {banner.starts_at ? formatDate(banner.starts_at, lang) : "boshlanishi belgilanmagan"} –{" "}
        {banner.ends_at ? formatDate(banner.ends_at, lang) : "tugashi belgilanmagan"}
      </p>
      <p className="type-caption mt-1">
        {groupDigits(banner.impressions)} ko'rish · {groupDigits(banner.clicks)} bosish
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={onToggle}>
          {banner.is_active ? "O'chirish" : "Yoqish"}
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          aria-label={`${banner.headline_uz} bannerini o'chirish`}
          onClick={onDelete}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}

function BannerForm({ onDone }: { onDone: () => void }) {
  const create = useCreateBanner();
  const [slot, setSlot] = useState<AdSlot>("HOME_SLIDER");
  const [imageUrl, setImageUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [cta, setCta] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const sortValue = Number(sortOrder);
  const valid = imageUrl.trim() !== "" && headline.trim() !== "" && Number.isFinite(sortValue);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const input: BannerIn = {
      slot,
      image_url: imageUrl.trim(),
      headline_uz: headline.trim(),
      subtitle_uz: subtitle.trim() === "" ? null : subtitle.trim(),
      cta_uz: cta.trim() === "" ? null : cta.trim(),
      link_url: linkUrl.trim() === "" ? null : linkUrl.trim(),
      sort_order: Math.trunc(sortValue),
      is_active: true,
      starts_at: toIso(startsAt),
      ends_at: toIso(endsAt),
    };
    create.mutate(input, { onSuccess: onDone });
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field label="Slot" hint="Banner qaysi o'rinda ko'rinadi.">
        <Select value={slot} onChange={(event) => setSlot(event.target.value as AdSlot)}>
          {SLOTS.map((option) => (
            <option key={option} value={option}>
              {SLOT_UZ[option] ?? option}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Rasm manzili" hint="To'liq URL. Eng yaxshi nisbat 3:1.">
        <Input
          type="url"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="https://cdn.avtoqism.uz/banners/qish.jpg"
          required
        />
      </Field>

      <Field label="Sarlavha">
        <Input
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          maxLength={80}
          required
        />
      </Field>

      <Field label="Kichik sarlavha">
        <Input
          value={subtitle}
          onChange={(event) => setSubtitle(event.target.value)}
          maxLength={120}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tugma matni">
          <Input value={cta} onChange={(event) => setCta(event.target.value)} maxLength={30} />
        </Field>
        <Field label="Tartib" hint="Kichik raqam oldinroq ko'rinadi.">
          <Input
            type="number"
            step={1}
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Havola" hint="Banner bosilganda ochiladigan sahifa.">
        <Input
          type="url"
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
          placeholder="https://avtoqism.uz/marketplace"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Boshlanish" hint="Bo'sh qoldirilsa darhol ko'rinadi.">
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </Field>
        <Field label="Tugash" hint="Bo'sh qoldirilsa muddatsiz.">
          <Input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </Field>
      </div>

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
