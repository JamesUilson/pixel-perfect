/**
 * Reklama — campaigns, shown as cards rather than rows.
 *
 * An advert is a picture with a budget attached, so a table is the wrong shape
 * for it: what a seller checks is whether the creative looks right, how much of
 * the budget is gone and whether anyone is clicking. Those three things are what
 * a card shows at a glance. The numbers live one click deeper, in the two charts
 * a selected campaign opens — impressions and clicks together on one scale, and
 * spend on its own, because som and counts are not the same magnitude.
 *
 * Creating one is a stepped flow rather than a form, and it lives in
 * `components/avtoqism/ads/CampaignWizard.tsx`. The reason is the money: the old
 * form asked for a budget and a date range before the seller had seen what they
 * were buying or what it would look like on the page. The wizard asks in the
 * order the decisions are actually made and puts the whole thing on one screen
 * before anything is created.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/avtoqism/Page";
import { CampaignWizard } from "@/components/avtoqism/ads/CampaignWizard";
import { ErrorState, LineSkeleton } from "@/components/avtoqism/States";
import { ChartCard, Meter, MultiLine, RevenueArea, num } from "@/components/avtoqism/panel/Charts";
import { PanelSection, PanelToolbar } from "@/components/avtoqism/panel/PanelShell";
import { useSellerId } from "@/components/avtoqism/panel/SellerContext";
import {
  Button,
  ExportButton,
  Field,
  Input,
  Panel,
  Pill,
} from "@/components/avtoqism/panel/Widgets";
import type { AdCampaignStatus, CampaignOut, PlacementOut } from "@/lib/api/types";
import { formatDate, formatSom, groupDigits } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import {
  useAddCreative,
  useCampaignDaily,
  useCampaigns,
  useCampaignStatus,
  useDeleteCreative,
  usePlacements,
} from "@/lib/query/seller";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/ads")({
  head: () => ({
    meta: [{ title: "Reklama — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: SellerAds,
});

const STATUS_UZ: Record<
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

/** Only the moves the server accepts from a seller. Everything else is admin. */
const NEXT_STATUS: Record<string, { status: AdCampaignStatus; label: string } | undefined> = {
  DRAFT: { status: "PENDING_REVIEW", label: "Tekshiruvga yuborish" },
  PENDING_REVIEW: { status: "DRAFT", label: "Qoralamaga qaytarish" },
  ACTIVE: { status: "PAUSED", label: "To'xtatish" },
  PAUSED: { status: "ACTIVE", label: "Davom ettirish" },
  REJECTED: { status: "DRAFT", label: "Qayta tahrirlash" },
};

function ctrLabel(campaign: CampaignOut): string {
  if (campaign.impressions === 0) return "—";
  return `${((campaign.clicks / campaign.impressions) * 100).toFixed(2)}%`;
}

/** The daily endpoint sends a full timestamp; the charts key on a plain day. */
function toChartRows<T extends { day: string }>(rows: T[]): (T & { day: string })[] {
  return rows.map((row) => ({ ...row, day: row.day.slice(0, 10) }));
}

/* --- screen ------------------------------------------------------------------- */
function SellerAds() {
  const sellerId = useSellerId();
  const { lang } = useLang();

  const campaigns = useCampaigns(sellerId);
  const placements = usePlacements();
  const changeStatus = useCampaignStatus(sellerId);

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creativeFor, setCreativeFor] = useState<CampaignOut | null>(null);

  const rows = campaigns.data ?? [];
  const selected = rows.find((campaign) => campaign.id === selectedId) ?? null;

  const placementById = useMemo(() => {
    const map = new Map<string, PlacementOut>();
    for (const placement of placements.data ?? []) map.set(placement.id, placement);
    return map;
  }, [placements.data]);

  return (
    <div className="space-y-6">
      <PanelToolbar>
        <Button onClick={() => setCreateOpen(true)} disabled={createOpen}>
          <Plus className="size-4" aria-hidden />
          Kampaniya yaratish
        </Button>
        <span className="ml-auto">
          <ExportButton path={`/export/seller/${sellerId}/campaigns`} />
        </span>
      </PanelToolbar>

      {/*
       * Full width rather than a dialog: five steps, a live preview and a review
       * table do not fit in a phone-sized modal, and a wizard that has to scroll
       * inside a box is how people lose track of which step they are on. The
       * list below stays exactly where it was.
       */}
      {createOpen && (
        <PanelSection
          title="Yangi kampaniya"
          subtitle="Besh qadam: maqsad, ko'rinish, auditoriya, jadval va tekshirish."
          action={
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Yopish
            </Button>
          }
        >
          <div className="p-5">
            <CampaignWizard
              sellerId={sellerId}
              placements={placements.data ?? []}
              placementsPending={placements.isPending}
              onDone={() => setCreateOpen(false)}
            />
          </div>
        </PanelSection>
      )}

      {campaigns.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="border border-border bg-card p-5">
              <LineSkeleton className="mb-4 h-5 w-40" />
              <LineSkeleton className="mb-3 h-28 w-full" />
              <LineSkeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      ) : campaigns.isError ? (
        <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} compact />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Hali kampaniya yo'q"
          subtitle="Bosh sahifa slayderi va katalog bannerlari — mahsulotingizni ko'proq odam ko'rishi uchun."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Kampaniya yaratish
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              placement={placementById.get(campaign.placement_id) ?? null}
              selected={campaign.id === selectedId}
              lang={lang}
              busy={changeStatus.isPending && changeStatus.variables?.campaignId === campaign.id}
              error={
                changeStatus.isError && changeStatus.variables?.campaignId === campaign.id
                  ? changeStatus.error.message
                  : null
              }
              onSelect={() => setSelectedId(campaign.id === selectedId ? null : campaign.id)}
              onStatus={(status) => changeStatus.mutate({ campaignId: campaign.id, status })}
              onCreatives={() => setCreativeFor(campaign)}
            />
          ))}
        </div>
      )}

      {selected && <CampaignCharts sellerId={sellerId} campaign={selected} />}

      <Panel
        open={creativeFor !== null}
        title="Reklama materiallari"
        onClose={() => setCreativeFor(null)}
      >
        {creativeFor && (
          <CreativePanel
            sellerId={sellerId}
            campaign={creativeFor}
            placement={placementById.get(creativeFor.placement_id) ?? null}
          />
        )}
      </Panel>
    </div>
  );
}

/* --- card ------------------------------------------------------------------------ */
function CampaignCard({
  campaign,
  placement,
  selected,
  lang,
  busy,
  error,
  onSelect,
  onStatus,
  onCreatives,
}: {
  campaign: CampaignOut;
  placement: PlacementOut | null;
  selected: boolean;
  lang: "uz" | "ru";
  busy: boolean;
  error: string | null;
  onSelect: () => void;
  onStatus: (status: AdCampaignStatus) => void;
  onCreatives: () => void;
}) {
  const status = STATUS_UZ[campaign.status] ?? { label: campaign.status, tone: "neutral" as const };
  const next = NEXT_STATUS[campaign.status];
  const spent = num(campaign.spent);
  const budget = num(campaign.budget);
  const share = budget > 0 ? spent / budget : 0;
  const creative = campaign.creatives[0];

  return (
    <article
      className={cn(
        "flex flex-col border bg-card p-5 transition-colors",
        selected ? "border-primary" : "border-border",
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="type-h3 min-w-0 flex-1 truncate">{campaign.title}</h3>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>
      <p className="type-caption">
        {placement?.name_uz ?? "O'rin"} · {formatDate(campaign.starts_at, lang)}–
        {formatDate(campaign.ends_at, lang)}
      </p>

      {creative && (
        <img
          src={creative.image_url}
          alt={creative.headline_uz}
          loading="lazy"
          className="mt-4 h-32 w-full border border-border object-cover"
        />
      )}

      <div className="mt-4">
        <Meter
          value={spent}
          max={budget}
          label={`${formatSom(spent)} / ${formatSom(budget)}`}
          tone={share >= 1 ? "critical" : share >= 0.8 ? "warning" : "neutral"}
        />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="type-caption">Ko'rishlar</dt>
          <dd className="font-semibold tabular-nums">{groupDigits(campaign.impressions)}</dd>
        </div>
        <div>
          <dt className="type-caption">Bosishlar</dt>
          <dd className="font-semibold tabular-nums">{groupDigits(campaign.clicks)}</dd>
        </div>
        <div>
          <dt className="type-caption">CTR</dt>
          <dd className="font-semibold tabular-nums">{ctrLabel(campaign)}</dd>
        </div>
      </dl>

      {campaign.rejection_reason && (
        <p className="mt-3 border border-destructive/40 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          Rad etish sababi: {campaign.rejection_reason}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {next && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatus(next.status)}>
            {busy ? "Saqlanmoqda…" : next.label}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onCreatives}>
          Materiallar ({campaign.creatives.length})
        </Button>
        <Button size="sm" variant="ghost" aria-pressed={selected} onClick={onSelect}>
          {selected ? "Yopish" : "Ko'rsatkichlar"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </article>
  );
}

/* --- charts ----------------------------------------------------------------------- */
function CampaignCharts({ sellerId, campaign }: { sellerId: string; campaign: CampaignOut }) {
  const daily = useCampaignDaily(sellerId, campaign.id, 30);
  const rows = useMemo(() => toChartRows(daily.data ?? []), [daily.data]);

  if (daily.isPending) {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <section key={index} className="border border-border bg-card p-5">
            <LineSkeleton className="mb-4 h-5 w-48" />
            <LineSkeleton className="h-[260px] w-full" />
          </section>
        ))}
      </div>
    );
  }

  if (daily.isError) {
    return (
      <section className="border border-border bg-card p-5">
        <h3 className="type-h3 mb-4">{campaign.title} — kunlik ko'rsatkichlar</h3>
        <ErrorState error={daily.error} onRetry={() => void daily.refetch()} compact />
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="border border-border bg-card p-5">
        <h3 className="type-h3">{campaign.title} — kunlik ko'rsatkichlar</h3>
        <p className="type-caption py-12 text-center">
          Bu kampaniya bo'yicha hali ma'lumot yig'ilmagan.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Kunlik ko'rsatkichlar" subtitle={campaign.title}>
        <MultiLine
          data={rows}
          money={false}
          series={[
            { key: "impressions", name: "Ko'rishlar" },
            { key: "clicks", name: "Bosishlar" },
          ]}
        />
      </ChartCard>
      <ChartCard title="Kunlik sarf" subtitle={campaign.title}>
        <RevenueArea data={rows} valueKey="spend" name="Sarf" />
      </ChartCard>
    </div>
  );
}

/* --- creatives ---------------------------------------------------------------------- */
function CreativePanel({
  sellerId,
  campaign,
  placement,
}: {
  sellerId: string;
  campaign: CampaignOut;
  placement: PlacementOut | null;
}) {
  const add = useAddCreative(sellerId);
  const remove = useDeleteCreative(sellerId);

  const [imageUrl, setImageUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [cta, setCta] = useState("");
  const [link, setLink] = useState("");

  const sizeHint =
    placement?.width && placement.height
      ? `Tavsiya etilgan o'lcham: ${placement.width}×${placement.height} piksel.`
      : "Keng, aniq rasm tanlang.";

  const valid = imageUrl.trim() !== "" && headline.trim() !== "";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    add.mutate(
      {
        campaignId: campaign.id,
        image_url: imageUrl.trim(),
        headline_uz: headline.trim(),
        subtitle_uz: subtitle.trim() || null,
        cta_uz: cta.trim() || null,
        link_url: link.trim() || null,
        sort_order: campaign.creatives.length,
      },
      {
        onSuccess: () => {
          setImageUrl("");
          setHeadline("");
          setSubtitle("");
          setCta("");
          setLink("");
        },
      },
    );
  }

  return (
    <div className="space-y-5">
      <PanelSection title="Mavjud materiallar">
        {campaign.creatives.length === 0 ? (
          <p className="type-caption p-5">Hali material qo'shilmagan.</p>
        ) : (
          <ul className="divide-y divide-border">
            {campaign.creatives.map((creative) => (
              <li key={creative.id} className="flex items-center gap-3 p-4">
                <img
                  src={creative.image_url}
                  alt={creative.headline_uz}
                  loading="lazy"
                  className="size-14 shrink-0 border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{creative.headline_uz}</p>
                  {creative.subtitle_uz && (
                    <p className="type-caption truncate">{creative.subtitle_uz}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  aria-label={`${creative.headline_uz} materialini o'chirish`}
                  disabled={remove.isPending && remove.variables === creative.id}
                  onClick={() => remove.mutate(creative.id)}
                >
                  O'chirish
                </Button>
              </li>
            ))}
          </ul>
        )}
        {remove.isError && (
          <p className="px-4 pb-4 text-xs text-destructive">{remove.error.message}</p>
        )}
      </PanelSection>

      <form className="space-y-4" onSubmit={submit}>
        <Field label="Rasm manzili" hint={sizeHint}>
          <Input
            type="url"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://…"
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
        <Field label="Tugma matni" hint="Masalan: Xarid qilish.">
          <Input value={cta} onChange={(event) => setCta(event.target.value)} maxLength={32} />
        </Field>
        <Field label="Havola" hint="Bosilganda ochiladigan sahifa.">
          <Input
            type="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://…"
          />
        </Field>

        {add.isError && <p className="text-sm text-destructive">{add.error.message}</p>}

        <Button type="submit" disabled={!valid || add.isPending}>
          {add.isPending ? "Qo'shilmoqda…" : "Material qo'shish"}
        </Button>
      </form>
    </div>
  );
}
