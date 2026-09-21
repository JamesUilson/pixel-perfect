/**
 * Creating a campaign, one decision at a time.
 *
 * A campaign spends money, and the old single form asked for a budget and a
 * date range before the seller had seen what they were buying or what it would
 * look like. The order here is the order of the decisions: what am I buying,
 * what does it look like, who sees it, when and for how much, and finally the
 * whole thing on one screen before anything is created.
 *
 * Every field below maps to something `app/modules/ads` actually stores. Where
 * the wizard shows a concept the API does not have — an "objective" — it is
 * derived from a field that does exist (`AdPlacement.pricing_model`) and is
 * never sent; it only filters which placements are offered. Nothing here
 * invents a targeting dimension the serve query cannot use.
 *
 * The estimate in step 4 is arithmetic on the placement's own price list, not a
 * forecast: CPM buys impressions at `price_cpm / 1000` each, CPC buys clicks at
 * `price_cpc`, FLAT buys days at `price_flat_daily`. It is labelled as the most
 * the budget can buy, because that is all the price list can honestly say.
 */
import { useMemo, useRef, useState } from "react";
import { Check, ImageUp, Loader2 } from "lucide-react";

import { LineSkeleton } from "@/components/avtoqism/States";
import { Button, Field, Input, Select } from "@/components/avtoqism/panel/Widgets";
import { num } from "@/components/avtoqism/panel/Charts";
import { UZ_REGIONS } from "@/components/avtoqism/auth/rules";
import type { PlacementOut } from "@/lib/api/types";
import { formatSom, groupDigits } from "@/lib/format";
import { useCategories } from "@/lib/query/catalog";
import { useVehicleBrands, useVehicleModels } from "@/lib/query/garage";
import { useCreateCampaignWithCreative, useUploadFile } from "@/lib/query/seller";
import { cn } from "@/lib/utils";
import { SlidePreview } from "./SlidePreview";

const STEPS = ["Maqsad", "Ko'rinish", "Auditoriya", "Jadval", "Tekshirish"] as const;

const MB = 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * MB;

/**
 * What each pricing model is actually buying, in the seller's words.
 *
 * There is no `objective` column on a campaign — the slot's price list decides
 * how the money is spent, so the objective *is* the pricing model.
 */
const OBJECTIVES: {
  pricing: "CPM" | "CPC" | "FLAT";
  title: string;
  detail: string;
}[] = [
  {
    pricing: "CPM",
    title: "Ko'proq odam ko'rsin",
    detail: "Har 1000 ko'rish uchun to'laysiz. Do'konni tanitish uchun.",
  },
  {
    pricing: "CPC",
    title: "Ko'proq odam bossin",
    detail: "Faqat bosilganda to'laysiz. Mahsulotga olib kelish uchun.",
  },
  {
    pricing: "FLAT",
    title: "O'rinni band qilish",
    detail: "Kunlik doimiy narx. O'rin butun muddat davomida siznikida.",
  },
];

const PRICING_UZ: Record<string, string> = {
  CPM: "1000 ko'rish uchun",
  CPC: "har bir bosish uchun",
  FLAT: "kunlik",
};

function placementUnitPrice(placement: PlacementOut): number | null {
  const raw =
    placement.pricing_model === "CPM"
      ? placement.price_cpm
      : placement.pricing_model === "CPC"
        ? placement.price_cpc
        : placement.price_flat_daily;
  return raw == null ? null : num(raw);
}

function placementPriceLabel(placement: PlacementOut): string {
  const price = placementUnitPrice(placement);
  if (price === null) return "narx kelishiladi";
  return `${formatSom(price)} ${PRICING_UZ[placement.pricing_model] ?? ""}`.trim();
}

/** Whole days between two `datetime-local` values; 0 when either is missing. */
function durationDays(startsAt: string, endsAt: string): number {
  if (startsAt === "" || endsAt === "") return 0;
  const from = new Date(startsAt).getTime();
  const to = new Date(endsAt).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return Math.max(1, Math.round((to - from) / 86_400_000));
}

/**
 * "What does this money buy?" — arithmetic on the price list, nothing more.
 *
 * Returned as a sentence rather than a number because the unit differs per
 * pricing model, and a bare figure with the wrong unit beside it is worse than
 * no figure at all.
 */
function budgetEstimate(
  placement: PlacementOut | null,
  budget: number,
  days: number,
): string | null {
  if (!placement || !Number.isFinite(budget) || budget <= 0) return null;
  const price = placementUnitPrice(placement);
  if (price === null || price <= 0) return null;

  if (placement.pricing_model === "CPM") {
    const impressions = Math.floor((budget / price) * 1000);
    return `Bu byudjetga eng ko'pi ${groupDigits(impressions)} ta ko'rish to'g'ri keladi.`;
  }
  if (placement.pricing_model === "CPC") {
    const clicks = Math.floor(budget / price);
    return `Bu byudjetga eng ko'pi ${groupDigits(clicks)} ta bosish to'g'ri keladi.`;
  }
  const paidDays = Math.floor(budget / price);
  const tail =
    days > 0 && paidDays < days
      ? ` Tanlangan muddat ${days} kun — byudjet ${paidDays} kundan keyin tugaydi.`
      : "";
  return `Bu byudjet ${paidDays} kunlik joylashuvga yetadi.${tail}`;
}

type Draft = {
  objective: "CPM" | "CPC" | "FLAT" | null;
  placementId: string;
  title: string;
  imageUrl: string;
  headline: string;
  subtitle: string;
  cta: string;
  linkUrl: string;
  region: string;
  categoryId: string;
  brandSlug: string;
  modelId: string;
  startsAt: string;
  endsAt: string;
  budget: string;
  dailyCap: string;
  submitForReview: boolean;
};

const EMPTY: Draft = {
  objective: null,
  placementId: "",
  title: "",
  imageUrl: "",
  headline: "",
  subtitle: "",
  cta: "",
  linkUrl: "",
  region: "",
  categoryId: "",
  brandSlug: "",
  modelId: "",
  startsAt: "",
  endsAt: "",
  budget: "",
  dailyCap: "",
  submitForReview: true,
};

export function CampaignWizard({
  sellerId,
  placements,
  placementsPending,
  onDone,
}: {
  sellerId: string;
  placements: PlacementOut[];
  placementsPending: boolean;
  onDone: () => void;
}) {
  const create = useCreateCampaignWithCreative(sellerId);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  /** Set when the campaign was created but a later call refused. */
  const [partial, setPartial] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const usable = useMemo(() => placements.filter((placement) => placement.is_active), [placements]);
  const offered = useMemo(
    () =>
      draft.objective === null
        ? usable
        : usable.filter((placement) => placement.pricing_model === draft.objective),
    [usable, draft.objective],
  );
  const placement = usable.find((option) => option.id === draft.placementId) ?? null;

  const minBudget = placement ? num(placement.min_budget) : 0;
  const budgetValue = Number(draft.budget);
  const days = durationDays(draft.startsAt, draft.endsAt);

  const stepValid = [
    draft.placementId !== "" && draft.title.trim().length >= 2,
    draft.imageUrl !== "" && draft.headline.trim().length >= 2,
    true,
    Number.isFinite(budgetValue) &&
      budgetValue >= minBudget &&
      budgetValue > 0 &&
      draft.startsAt !== "" &&
      draft.endsAt !== "" &&
      days > 0,
    true,
  ];

  if (placementsPending) return <LineSkeleton className="h-40 w-full" />;
  if (usable.length === 0) {
    return (
      <p className="type-caption">Hozircha bo'sh reklama o'rni yo'q. Keyinroq urinib ko'ring.</p>
    );
  }

  function submit() {
    if (!stepValid.every(Boolean) || create.isPending) return;
    setPartial(null);
    create.mutate(
      {
        placement_id: draft.placementId,
        title: draft.title.trim(),
        budget: budgetValue,
        daily_cap: draft.dailyCap.trim() === "" ? null : Number(draft.dailyCap),
        starts_at: new Date(draft.startsAt).toISOString(),
        ends_at: new Date(draft.endsAt).toISOString(),
        target_region: draft.region === "" ? null : draft.region,
        target_category_id: draft.categoryId === "" ? null : draft.categoryId,
        target_model_id: draft.modelId === "" ? null : draft.modelId,
        creative: {
          image_url: draft.imageUrl,
          headline_uz: draft.headline.trim(),
          subtitle_uz: draft.subtitle.trim() === "" ? null : draft.subtitle.trim(),
          cta_uz: draft.cta.trim() === "" ? null : draft.cta.trim(),
          link_url: draft.linkUrl.trim() === "" ? null : draft.linkUrl.trim(),
        },
        submitForReview: draft.submitForReview,
      },
      {
        onSuccess: (result) => {
          if (result.partialError === null) {
            onDone();
            return;
          }
          // The campaign exists and is a draft, so nothing is being spent — but
          // the seller has to be told which half did not land.
          setPartial(
            result.creative === null
              ? `Kampaniya yaratildi, lekin rasm biriktirilmadi: ${result.partialError.message} Materiallar oynasidan qayta urinib ko'ring.`
              : `Kampaniya va rasm saqlandi, lekin tekshiruvga yuborilmadi: ${result.partialError.message}`,
          );
        },
      },
    );
  }

  return (
    <div className="space-y-5">
      <StepBar step={step} onJump={(target) => setStep(target)} valid={stepValid} />

      {step === 0 && (
        <ObjectiveStep
          draft={draft}
          set={set}
          usable={usable}
          offered={offered}
          placement={placement}
        />
      )}
      {step === 1 && (
        <CreativeStep sellerId={sellerId} draft={draft} set={set} placement={placement} />
      )}
      {step === 2 && <AudienceStep draft={draft} set={set} />}
      {step === 3 && (
        <ScheduleStep
          draft={draft}
          set={set}
          placement={placement}
          minBudget={minBudget}
          days={days}
        />
      )}
      {step === 4 && <ReviewStep draft={draft} set={set} placement={placement} days={days} />}

      {create.isError && <p className="text-sm text-destructive">{create.error.message}</p>}
      {partial && (
        <p
          role="alert"
          className="border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground"
        >
          {partial}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {step > 0 ? (
          <Button variant="outline" onClick={() => setStep((current) => current - 1)}>
            Orqaga
          </Button>
        ) : (
          <Button variant="ghost" onClick={onDone}>
            Bekor qilish
          </Button>
        )}

        {step < STEPS.length - 1 ? (
          <Button disabled={!stepValid[step]} onClick={() => setStep((current) => current + 1)}>
            Davom etish
          </Button>
        ) : (
          <Button disabled={!stepValid.every(Boolean) || create.isPending} onClick={submit}>
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            {draft.submitForReview
              ? "Yaratish va tekshiruvga yuborish"
              : "Qoralama sifatida saqlash"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* --- the step strip ---------------------------------------------------------------- */
function StepBar({
  step,
  valid,
  onJump,
}: {
  step: number;
  valid: boolean[];
  onJump: (target: number) => void;
}) {
  return (
    <ol className="flex gap-1" aria-label="Kampaniya yaratish bosqichlari">
      {STEPS.map((label, index) => {
        const done = index < step;
        const current = index === step;
        // Only backwards, and only forwards over steps that are already valid:
        // jumping into step 5 with no creative would show a review of nothing.
        const reachable = index <= step || valid.slice(0, index).every(Boolean);
        return (
          <li key={label} className="min-w-0 flex-1">
            <button
              type="button"
              disabled={!reachable}
              aria-current={current ? "step" : undefined}
              onClick={() => reachable && onJump(index)}
              className={cn(
                "w-full border-b-2 px-1 pb-2 text-left text-xs font-semibold transition-colors disabled:opacity-40",
                current
                  ? "border-primary text-primary"
                  : done
                    ? "border-success text-foreground"
                    : "border-border text-muted-foreground",
              )}
            >
              <span className="block truncate">
                {index + 1}. {label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

type SetField = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

/* --- 1. objective and placement ----------------------------------------------------- */
function ObjectiveStep({
  draft,
  set,
  usable,
  offered,
  placement,
}: {
  draft: Draft;
  set: SetField;
  /** Every active placement, so an objective nobody sells can be shown as such. */
  usable: PlacementOut[];
  offered: PlacementOut[];
  placement: PlacementOut | null;
}) {
  const sold = new Set(usable.map((option) => option.pricing_model));

  return (
    <div className="space-y-5">
      <div>
        <p className="type-label text-muted-foreground">Maqsad</p>
        <p className="type-caption mt-1">
          Maqsad o'rinning narxlash usulidan kelib chiqadi: qaysi maqsadni tanlasangiz, shu usulda
          hisoblanadigan o'rinlar ko'rsatiladi.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {OBJECTIVES.map((objective) => {
            const hasAny = sold.has(objective.pricing);
            const selected = draft.objective === objective.pricing;
            return (
              <button
                key={objective.pricing}
                type="button"
                disabled={!hasAny}
                title={hasAny ? undefined : "Bu maqsad uchun hozircha o'rin sotilmayapti."}
                aria-pressed={selected}
                onClick={() => {
                  set("objective", selected ? null : objective.pricing);
                  set("placementId", "");
                }}
                className={cn(
                  "border p-4 text-left transition-colors disabled:opacity-50",
                  selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted",
                )}
              >
                <span className="block text-sm font-semibold">{objective.title}</span>
                <span className="type-caption mt-1 block">{objective.detail}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Field
        label="Reklama o'rni"
        hint={
          placement
            ? `${placementPriceLabel(placement)} · eng kam byudjet ${formatSom(placement.min_budget)}`
            : offered.length === 0
              ? "Bu maqsad uchun bo'sh o'rin yo'q — boshqa maqsadni tanlang."
              : "Reklama qayerda chiqishini tanlang."
        }
      >
        <Select
          value={draft.placementId}
          onChange={(event) => set("placementId", event.target.value)}
        >
          <option value="">Tanlang</option>
          {offered.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name_uz} — {placementPriceLabel(option)}
            </option>
          ))}
        </Select>
      </Field>

      {placement?.description_uz && <p className="type-caption">{placement.description_uz}</p>}

      <Field label="Kampaniya nomi" hint="Faqat siz ko'rasiz — kampaniyalarni ajratish uchun.">
        <Input
          value={draft.title}
          onChange={(event) => set("title", event.target.value)}
          maxLength={150}
          placeholder="Qish chegirmasi — bosh sahifa"
        />
      </Field>
    </div>
  );
}

/* --- 2. the creative ---------------------------------------------------------------- */
function CreativeStep({
  sellerId,
  draft,
  set,
  placement,
}: {
  sellerId: string;
  draft: Draft;
  set: SetField;
  placement: PlacementOut | null;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const upload = useUploadFile({ onProgress: setProgress });

  const sizeHint =
    placement?.width && placement.height
      ? `Tavsiya etilgan o'lcham: ${placement.width}×${placement.height} piksel.`
      : "Keng, aniq rasm tanlang.";

  function choose(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setLocalError(`Fayl juda katta. Eng ko'pi ${MAX_IMAGE_BYTES / MB} MB.`);
      return;
    }
    setLocalError(null);
    setProgress(0);
    upload.mutate(
      // AD_CREATIVE is a store-scoped purpose: the server refuses it without a
      // seller id and checks membership before it writes a byte.
      { file, purpose: "AD_CREATIVE", sellerId },
      {
        onSuccess: (row) => {
          setProgress(null);
          set("imageUrl", row.url);
        },
        onError: () => setProgress(null),
      },
    );
  }

  const error = localError ?? (upload.isError ? upload.error.message : null);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <p className="type-label text-muted-foreground">Rasm</p>
          <p className="type-caption mt-1">
            {sizeHint} JPEG, PNG yoki WEBP. Eng ko'pi {MAX_IMAGE_BYTES / MB} MB.
          </p>
          {progress !== null && (
            <div
              className="mt-2 h-1.5 w-full bg-muted"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Yuklanmoqda"
            >
              <div
                className="h-full bg-primary transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <div className="mt-3">
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Reklama rasmi"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Cleared so picking the same file again still fires a change.
                event.target.value = "";
                choose(file);
              }}
            />
            <Button
              variant="outline"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ImageUp className="size-4" aria-hidden />
              )}
              {upload.isPending
                ? `Yuklanmoqda… ${progress ?? 0}%`
                : draft.imageUrl
                  ? "Rasmni almashtirish"
                  : "Rasm yuklash"}
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        <Field label="Sarlavha" hint="Slaydda eng katta yozuv.">
          <Input
            value={draft.headline}
            onChange={(event) => set("headline", event.target.value)}
            maxLength={120}
            placeholder="Original tormoz kolodkalari"
          />
        </Field>

        <Field label="Kichik sarlavha" hint="Ixtiyoriy. Bitta qisqa jumla.">
          <Input
            value={draft.subtitle}
            onChange={(event) => set("subtitle", event.target.value)}
            maxLength={200}
            placeholder="Cobalt va Nexia uchun — omborda bor"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tugma matni" hint="Bo'sh qolsa “Ko'rish” chiqadi.">
            <Input
              value={draft.cta}
              onChange={(event) => set("cta", event.target.value)}
              maxLength={40}
              placeholder="Xarid qilish"
            />
          </Field>
          <Field label="Havola" hint="Bosilganda ochiladigan sahifa.">
            <Input
              type="url"
              value={draft.linkUrl}
              onChange={(event) => set("linkUrl", event.target.value)}
              maxLength={600}
              placeholder="https://…"
            />
          </Field>
        </div>
      </div>

      <div>
        <p className="type-label mb-2 text-muted-foreground">Qanday ko'rinadi</p>
        <SlidePreview
          slot={placement?.slot ?? "HOME_SLIDER"}
          imageUrl={draft.imageUrl === "" ? null : draft.imageUrl}
          headline={draft.headline}
          subtitle={draft.subtitle}
          cta={draft.cta}
        />
      </div>
    </div>
  );
}

/* --- 3. audience --------------------------------------------------------------------- */
/**
 * The three dimensions the campaign table actually has: `target_region`,
 * `target_category_id`, `target_model_id`. There is no brand column — the brand
 * select below exists only to find a model, and what is stored is the model.
 *
 * Narrowing is not free, and the serve query is the reason: a page that carries
 * no category only matches campaigns with no category target. So the screen
 * says that rather than letting a seller discover it from a flat impression
 * count.
 */
function AudienceStep({ draft, set }: { draft: Draft; set: SetField }) {
  const categories = useCategories();
  const brands = useVehicleBrands();
  const models = useVehicleModels(draft.brandSlug === "" ? null : draft.brandSlug);

  const narrowed = [draft.region, draft.categoryId, draft.modelId].filter(
    (value) => value !== "",
  ).length;

  return (
    <div className="space-y-4">
      <p className="type-caption">
        Hech narsa tanlamasangiz, reklama hammaga ko'rinadi. Har bir cheklov auditoriyani
        toraytiradi: masalan kategoriya tanlansa, reklama faqat o'sha kategoriya sahifalarida
        chiqadi.
      </p>

      <Field label="Viloyat" hint="Xaridorning joylashuvi bo'yicha.">
        <Select value={draft.region} onChange={(event) => set("region", event.target.value)}>
          <option value="">Butun O'zbekiston</option>
          {UZ_REGIONS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Kategoriya"
        hint={categories.isError ? "Kategoriyalarni yuklab bo'lmadi." : "Detal turi bo'yicha."}
      >
        <Select
          value={draft.categoryId}
          onChange={(event) => set("categoryId", event.target.value)}
          disabled={categories.isPending}
        >
          <option value="">Barcha kategoriyalar</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name_uz}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marka" hint="Modelni topish uchun. Marka alohida saqlanmaydi.">
          <Select
            value={draft.brandSlug}
            onChange={(event) => {
              set("brandSlug", event.target.value);
              set("modelId", "");
            }}
            disabled={brands.isPending}
          >
            <option value="">Barcha markalar</option>
            {(brands.data ?? []).map((brand) => (
              <option key={brand.id} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Model" hint="Reklama shu modelga qiziqqanlarga ko'rinadi.">
          <Select
            value={draft.modelId}
            onChange={(event) => set("modelId", event.target.value)}
            disabled={draft.brandSlug === "" || models.isPending}
          >
            <option value="">Barcha modellar</option>
            {(models.data ?? []).map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <p className="type-caption">
        {narrowed === 0
          ? "Hozircha cheklov yo'q — eng keng auditoriya."
          : `${narrowed} ta cheklov qo'yildi. Auditoriya torayadi, lekin ko'rsatkichlar aniqroq bo'ladi.`}
      </p>
    </div>
  );
}

/* --- 4. schedule and budget ----------------------------------------------------------- */
function ScheduleStep({
  draft,
  set,
  placement,
  minBudget,
  days,
}: {
  draft: Draft;
  set: SetField;
  placement: PlacementOut | null;
  minBudget: number;
  days: number;
}) {
  const budgetValue = Number(draft.budget);
  const budgetTooLow =
    draft.budget !== "" &&
    Number.isFinite(budgetValue) &&
    budgetValue > 0 &&
    budgetValue < minBudget;
  const badRange = draft.startsAt !== "" && draft.endsAt !== "" && days === 0;
  const estimate = budgetEstimate(placement, budgetValue, days);

  const capValue = Number(draft.dailyCap);
  const capDays =
    Number.isFinite(capValue) && capValue > 0 && budgetValue > 0
      ? Math.floor(budgetValue / capValue)
      : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Boshlanish">
          <Input
            type="datetime-local"
            value={draft.startsAt}
            onChange={(event) => set("startsAt", event.target.value)}
          />
        </Field>
        <Field
          label="Tugash"
          error={badRange ? "Tugash sanasi boshlanishdan keyin bo'lishi kerak." : undefined}
        >
          <Input
            type="datetime-local"
            value={draft.endsAt}
            onChange={(event) => set("endsAt", event.target.value)}
          />
        </Field>
      </div>
      {days > 0 && <p className="type-caption">Muddat: {days} kun.</p>}

      <Field
        label="Byudjet"
        hint={`Eng kam ${formatSom(minBudget)}. Kampaniya byudjet tugaganda to'xtaydi.`}
        error={
          budgetTooLow ? `Byudjet ${formatSom(minBudget)} dan kam bo'lmasligi kerak.` : undefined
        }
      >
        <Input
          type="number"
          min={minBudget}
          step={1000}
          inputMode="numeric"
          value={draft.budget}
          onChange={(event) => set("budget", event.target.value)}
        />
      </Field>

      <Field label="Kunlik cheklov" hint="Ixtiyoriy. Bir kunda sarflanadigan eng ko'p summa.">
        <Input
          type="number"
          min={0}
          step={1000}
          inputMode="numeric"
          value={draft.dailyCap}
          onChange={(event) => set("dailyCap", event.target.value)}
        />
      </Field>

      {(estimate ?? capDays !== null) && (
        <div className="border border-border bg-surface p-4">
          <p className="type-label text-muted-foreground">Pul nimaga yetadi</p>
          {estimate ? (
            <p className="mt-1 text-sm">{estimate}</p>
          ) : (
            <p className="type-caption mt-1">
              Bu o'rin uchun narx belgilanmagan — summani administrator bilan kelishasiz.
            </p>
          )}
          {capDays !== null && capDays > 0 && (
            <p className="type-caption mt-1">
              Kunlik cheklov bilan byudjet kamida {capDays} kunga cho'ziladi.
            </p>
          )}
          <p className="type-caption mt-2">
            Bu — narxlar ro'yxatidan chiqqan yuqori chegara, va'da emas: haqiqiy natija reklama
            necha marta ko'rinishiga bog'liq.
          </p>
        </div>
      )}
    </div>
  );
}

/* --- 5. review ------------------------------------------------------------------------ */
function ReviewStep({
  draft,
  set,
  placement,
  days,
}: {
  draft: Draft;
  set: SetField;
  placement: PlacementOut | null;
  days: number;
}) {
  const categories = useCategories();
  const models = useVehicleModels(draft.brandSlug === "" ? null : draft.brandSlug);

  const categoryName =
    (categories.data ?? []).find((category) => category.id === draft.categoryId)?.name_uz ?? null;
  const modelName = (models.data ?? []).find((model) => model.id === draft.modelId)?.name ?? null;

  const rows: { label: string; value: string }[] = [
    {
      label: "O'rin",
      value: placement ? `${placement.name_uz} — ${placementPriceLabel(placement)}` : "—",
    },
    { label: "Kampaniya nomi", value: draft.title.trim() || "—" },
    {
      label: "Muddat",
      value:
        draft.startsAt && draft.endsAt
          ? `${draft.startsAt.replace("T", " ")} — ${draft.endsAt.replace("T", " ")} (${days} kun)`
          : "—",
    },
    { label: "Byudjet", value: draft.budget ? formatSom(Number(draft.budget)) : "—" },
    {
      label: "Kunlik cheklov",
      value: draft.dailyCap.trim() === "" ? "Yo'q" : formatSom(Number(draft.dailyCap)),
    },
    { label: "Viloyat", value: draft.region || "Butun O'zbekiston" },
    { label: "Kategoriya", value: categoryName ?? "Barchasi" },
    { label: "Avtomobil modeli", value: modelName ?? "Barchasi" },
    { label: "Havola", value: draft.linkUrl.trim() || "Yo'q" },
  ];

  return (
    <div className="space-y-5">
      <p className="type-caption">
        Kampaniya pul sarflaydi. Yaratishdan oldin hamma narsani bir joyda ko'rib chiqing.
      </p>

      <SlidePreview
        slot={placement?.slot ?? "HOME_SLIDER"}
        imageUrl={draft.imageUrl === "" ? null : draft.imageUrl}
        headline={draft.headline}
        subtitle={draft.subtitle}
        cta={draft.cta}
      />

      <dl className="divide-y divide-border border border-border">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap gap-2 px-4 py-2.5">
            <dt className="type-caption w-40 shrink-0">{row.label}</dt>
            <dd className="min-w-0 flex-1 text-sm font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={draft.submitForReview}
          onChange={(event) => set("submitForReview", event.target.checked)}
          className="mt-0.5 size-4 shrink-0 border border-input accent-primary"
        />
        <span>
          Darhol tekshiruvga yuborilsin.{" "}
          <span className="text-muted-foreground">
            Administrator tasdiqlagandan keyin reklama chiqa boshlaydi. Belgilanmasa, kampaniya
            qoralama bo'lib qoladi va pul sarflanmaydi.
          </span>
        </span>
      </label>
    </div>
  );
}
