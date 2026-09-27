/**
 * Creating a clip, and editing one.
 *
 * One form for both, because the fields are the same and the only real
 * difference is that a new clip needs a file while an existing one already has
 * one. Three things are worth knowing while reading it:
 *
 *   - **the file is uploaded before the clip exists.** `/uploads` stores the
 *     bytes and hands back an id; this form only ever posts that id, which is
 *     why a refused file is reported next to the picker and not on submit;
 *   - **a product tag is a buy button**, so only the store's own catalogue is
 *     offered. The server refuses anything else outright and its sentence is
 *     shown as it arrives;
 *   - **editing sends the whole tag list or none of it.** The API has no way to
 *     remove a single tag, so the lists here are always complete.
 */
import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { MediaUpload, type ClipDimensions } from "@/components/avtoqism/creator/MediaUpload";
import { Button, Field, Input, Select, inputClass } from "@/components/avtoqism/panel/Widgets";
import { ApiError } from "@/lib/api/client";
import { formatSom } from "@/lib/format";
import { useVehicleBrands, useVehicleModels, useVehicleVariants } from "@/lib/query/garage";
import type { CreatorVideo, VideoVehicleTagIn } from "@/lib/query/seller";
import {
  useCreateVideo,
  usePublishVideo,
  useSellerOffers,
  useUpdateVideo,
} from "@/lib/query/seller";
import { cn } from "@/lib/utils";

/** The same list the onboarding form offers, so a store's clips match its papers. */
const REGIONS = [
  "Toshkent",
  "Toshkent viloyati",
  "Samarqand",
  "Buxoro",
  "Andijon",
  "Farg'ona",
  "Namangan",
  "Qashqadaryo",
  "Surxondaryo",
  "Jizzax",
  "Sirdaryo",
  "Navoiy",
  "Xorazm",
  "Qoraqalpog'iston",
];

const MAX_HASHTAGS = 30;
const MAX_TAGGED_PRODUCTS = 20;

/** "#Faralar, voltpro" -> ["faralar", "voltpro"]. The server tidies again. */
function parseHashtags(raw: string): string[] {
  const seen: string[] = [];
  for (const piece of raw.split(/[\s,]+/)) {
    const tag = piece.replace(/^#+/, "").trim().toLowerCase().slice(0, 50);
    if (tag && !seen.includes(tag)) seen.push(tag);
  }
  return seen.slice(0, MAX_HASHTAGS);
}

type PickedVehicle = VideoVehicleTagIn & { label: string };

export function VideoForm({
  sellerId,
  video,
  defaultRegion,
  onDone,
}: {
  sellerId: string;
  /** Null when creating. */
  video: CreatorVideo | null;
  defaultRegion: string;
  onDone: () => void;
}) {
  const offers = useSellerOffers(sellerId);
  const create = useCreateVideo(sellerId);
  const update = useUpdateVideo(sellerId);
  const publish = usePublishVideo(sellerId);

  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<ClipDimensions>({});
  const [thumbnailId, setThumbnailId] = useState<string | null>(null);
  const [thumbnailName, setThumbnailName] = useState<string | null>(
    video?.thumbnail_url ? "Joriy muqova" : null,
  );

  const [caption, setCaption] = useState(video?.caption ?? "");
  const [hashtags, setHashtags] = useState((video?.hashtags ?? []).map((t) => `#${t}`).join(" "));
  const [region, setRegion] = useState(video?.region ?? defaultRegion);
  const [district, setDistrict] = useState(video?.district ?? "");
  const [productIds, setProductIds] = useState<string[]>(
    (video?.products ?? []).map((p) => p.product_id),
  );
  const [vehicles, setVehicles] = useState<PickedVehicle[]>(
    (video?.vehicles ?? []).map((v) => ({
      label: v.label,
      ...(v.variant_id ? { variant_id: v.variant_id } : {}),
      ...(v.model_id ? { model_id: v.model_id } : {}),
    })),
  );
  const [publishNow, setPublishNow] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const busy = create.isPending || update.isPending || publish.isPending;
  const rows = offers.data ?? [];

  function toggleProduct(productId: string) {
    setProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : current.length >= MAX_TAGGED_PRODUCTS
          ? current
          : [...current, productId],
    );
  }

  async function submit() {
    setProblem(null);
    const body = {
      caption: caption.trim() || undefined,
      hashtags: parseHashtags(hashtags),
      region: region || undefined,
      district: district.trim() || undefined,
      products: productIds.map((id, index) => ({ product_id: id, sort_order: index })),
      vehicles: vehicles.map(({ label: _label, ...tag }) => tag),
    };

    try {
      if (video) {
        await update.mutateAsync({ videoId: video.id, ...body });
        onDone();
        return;
      }
      if (!fileId) {
        setProblem("Avval video faylni yuklang.");
        return;
      }
      const created = await create.mutateAsync({
        file_id: fileId,
        ...(thumbnailId ? { thumbnail_file_id: thumbnailId } : {}),
        ...dimensions,
        ...body,
      });
      if (publishNow) {
        try {
          await publish.mutateAsync(created.id);
        } catch (caught) {
          // The clip exists and is safe; only the last step failed, and saying
          // which half is missing beats reporting the whole thing as a failure.
          setProblem(
            caught instanceof ApiError
              ? `Video saqlandi, lekin e'lon qilinmadi: ${caught.message}`
              : "Video saqlandi, lekin e'lon qilinmadi.",
          );
          return;
        }
      }
      onDone();
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "Saqlab bo'lmadi.");
    }
  }

  return (
    <div className="space-y-6">
      {!video && (
        <div className="grid gap-4 sm:grid-cols-2">
          <MediaUpload
            sellerId={sellerId}
            purpose="VIDEO"
            label="Video fayl"
            hint="MP4 yoki MOV, eng ko'pi 200 MB. Fayl turi ichidagi ma'lumot bo'yicha tekshiriladi."
            {...(fileId && fileName ? { value: { name: fileName, url: null } } : {})}
            onUploaded={(row, measured) => {
              setFileId(row.id);
              setFileName(row.original_filename);
              setDimensions(measured);
            }}
            onClear={() => {
              setFileId(null);
              setFileName(null);
              setDimensions({});
            }}
          />
          <MediaUpload
            sellerId={sellerId}
            purpose="VIDEO_THUMBNAIL"
            label="Muqova rasmi (ixtiyoriy)"
            hint="JPEG, PNG yoki WEBP, eng ko'pi 5 MB."
            {...(thumbnailId && thumbnailName ? { value: { name: thumbnailName, url: null } } : {})}
            onUploaded={(row) => {
              setThumbnailId(row.id);
              setThumbnailName(row.original_filename);
            }}
            onClear={() => {
              setThumbnailId(null);
              setThumbnailName(null);
            }}
          />
        </div>
      )}

      {video && (
        <MediaUpload
          sellerId={sellerId}
          purpose="VIDEO_THUMBNAIL"
          label="Muqova rasmi"
          hint="Videoning o'zini almashtirib bo'lmaydi — yangi video sifatida joylang."
          {...(thumbnailName ? { value: { name: thumbnailName, url: video.thumbnail_url } } : {})}
          onUploaded={(row) => {
            setThumbnailId(row.id);
            setThumbnailName(row.original_filename);
          }}
          onClear={() => {
            setThumbnailId(null);
            setThumbnailName(null);
          }}
        />
      )}

      <Field label="Sarlavha" hint="Eng ko'pi 2200 belgi.">
        <textarea
          className={cn(inputClass, "min-h-24 resize-y")}
          maxLength={2200}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Bi-LED premium faralar to'plami — yorug'lik sifati 300% yuqori"
        />
      </Field>

      <Field label="Hashtaglar" hint={`Bo'sh joy bilan ajrating, eng ko'pi ${MAX_HASHTAGS} ta.`}>
        <Input
          value={hashtags}
          onChange={(event) => setHashtags(event.target.value)}
          placeholder="#avtoqism #toshkent #faralar"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mintaqa" hint="Lenta shu bo'yicha saralaydi.">
          <Select value={region} onChange={(event) => setRegion(event.target.value)}>
            {REGIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tuman (ixtiyoriy)">
          <Input
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
            placeholder="Yakkasaroy"
          />
        </Field>
      </div>

      <div>
        <span className="type-label mb-1.5 block text-muted-foreground">
          Mahsulotlar ({productIds.length}/{MAX_TAGGED_PRODUCTS})
        </span>
        <p className="type-caption mb-2">
          Faqat o'z do'koningiz mahsulotlari — videoga qo'yilgan teg xarid tugmasi bo'ladi.
        </p>
        {offers.isPending ? (
          <p className="type-caption">Yuklanmoqda…</p>
        ) : rows.length === 0 ? (
          <p className="type-caption">Do'konda hali mahsulot yo'q.</p>
        ) : (
          <div className="max-h-56 overflow-y-auto border border-border">
            {rows.map((offer) => {
              const checked = productIds.includes(offer.product_id);
              return (
                <label
                  key={offer.offer_id}
                  className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProduct(offer.product_id)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{offer.product_name}</span>
                  <span className="type-caption shrink-0">{formatSom(offer.price)}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <VehiclePicker
        picked={vehicles}
        onAdd={(vehicle) =>
          setVehicles((current) =>
            current.some((v) => v.label === vehicle.label) ? current : [...current, vehicle],
          )
        }
        onRemove={(label) => setVehicles((current) => current.filter((v) => v.label !== label))}
      />

      {!video && (
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={publishNow}
            onChange={(event) => setPublishNow(event.target.checked)}
            className="size-4 accent-primary"
          />
          Saqlagandan so'ng darhol e'lon qilish
        </label>
      )}

      {problem && (
        <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          {problem}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void submit()} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {video ? "Saqlash" : "Video qo'shish"}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Bekor qilish
        </Button>
        {video && (
          <p className="type-caption ml-auto">
            Tahrirdan so'ng video qaytadan moderatsiyaga tushadi.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Which car the clip is about.
 *
 * A whole model is a valid answer — "this fits every Cobalt" — so the variant
 * select is optional and the tag is stored at whichever level was chosen.
 */
function VehiclePicker({
  picked,
  onAdd,
  onRemove,
}: {
  picked: PickedVehicle[];
  onAdd: (vehicle: PickedVehicle) => void;
  onRemove: (label: string) => void;
}) {
  const [brandSlug, setBrandSlug] = useState("");
  const [modelId, setModelId] = useState("");
  const [variantId, setVariantId] = useState("");

  const brands = useVehicleBrands();
  const models = useVehicleModels(brandSlug || null);
  const variants = useVehicleVariants(modelId || null, null);

  const model = (models.data ?? []).find((m) => m.id === modelId) ?? null;
  const variant = (variants.data ?? []).find((v) => v.id === variantId) ?? null;
  const brand = (brands.data ?? []).find((b) => b.slug === brandSlug) ?? null;

  function add() {
    if (!model || !brand) return;
    const label = variant
      ? `${brand.name} ${model.name} — ${variant.display_name}`
      : `${brand.name} ${model.name}`;
    onAdd(variant ? { label, variant_id: variant.id } : { label, model_id: model.id });
    setVariantId("");
  }

  return (
    <div>
      <span className="type-label mb-1.5 block text-muted-foreground">
        Avtomobillar (ixtiyoriy)
      </span>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Select
          aria-label="Marka"
          value={brandSlug}
          onChange={(event) => {
            setBrandSlug(event.target.value);
            setModelId("");
            setVariantId("");
          }}
        >
          <option value="">Marka</option>
          {(brands.data ?? []).map((row) => (
            <option key={row.id} value={row.slug}>
              {row.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Model"
          value={modelId}
          disabled={!brandSlug}
          onChange={(event) => {
            setModelId(event.target.value);
            setVariantId("");
          }}
        >
          <option value="">Model</option>
          {(models.data ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Variant"
          value={variantId}
          disabled={!modelId}
          onChange={(event) => setVariantId(event.target.value)}
        >
          <option value="">Barcha variantlar</option>
          {(variants.data ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.display_name}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={add} disabled={!modelId}>
          <Plus className="size-4" aria-hidden />
          Qo'shish
        </Button>
      </div>

      {picked.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {picked.map((vehicle) => (
            <li
              key={vehicle.label}
              className="inline-flex items-center gap-2 border border-border bg-muted/50 px-2.5 py-1 text-xs"
            >
              {vehicle.label}
              <button
                type="button"
                onClick={() => onRemove(vehicle.label)}
                aria-label={`${vehicle.label} — olib tashlash`}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
