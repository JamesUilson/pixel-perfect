/**
 * The store-details form, and the panel that replaces it once the store exists.
 *
 * Both were written for `/seller/onboard` and both are now needed by the seller
 * registration path as well, so they were lifted out of that route rather than
 * copied into the new one: one form means one set of validation rules, one
 * wording of the approval warning, and one place where the map point becomes
 * optional. The markup is the same markup — only the sticky positioning and the
 * captions that differ between the two screens became props.
 */
import { useState } from "react";
import { Check, Clock } from "lucide-react";

import { ImageUpload } from "@/components/avtoqism/panel/ImageUpload";
import {
  EMPTY_COORDINATES,
  LocationPicker,
  coordinateProblem,
  coordinatePayload,
} from "@/components/avtoqism/panel/LocationPicker";
import type { Coordinates } from "@/components/avtoqism/panel/LocationPicker";
import { Button, Field, Input, Pill, inputClass } from "@/components/avtoqism/panel/Widgets";
import { ApiError } from "@/lib/api/client";
import { useOnboardSeller, useUpdateStore } from "@/lib/query/seller";
import type { SellerStore } from "@/lib/query/seller";

export const STORE_REGIONS = [
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

export function StoreDetailsForm({
  unverified,
  alreadyHasStores,
  onCreated,
  className = "space-y-4",
}: {
  /** The account cannot open a store yet; the form stays fillable but inert. */
  unverified: boolean;
  alreadyHasStores: boolean;
  onCreated: (seller: SellerStore) => void;
  className?: string | undefined;
}) {
  const onboard = useOnboardSeller();

  const [form, setForm] = useState({
    store_name: "",
    region: STORE_REGIONS[0] as string,
    district: "",
    address: "",
    phone: "",
    description_uz: "",
  });
  const [touched, setTouched] = useState(false);
  const [point, setPoint] = useState<Coordinates>(EMPTY_COORDINATES);

  const nameError =
    touched && form.store_name.trim().length < 2 ? "Do'kon nomini kiriting." : undefined;
  const districtError =
    touched && form.district.trim().length < 2 ? "Tumanni kiriting." : undefined;
  const pointError = coordinateProblem(point);
  const valid = !nameError && !districtError && !pointError && form.store_name && form.district;

  /**
   * `mutate`, not `mutateAsync`: the rejected promise from `mutateAsync` had no
   * catch, so every refusal — including the verification 403 — showed the error
   * *and* logged an unhandled rejection. The mutation's own error state is what
   * the form renders, so the callback form is both shorter and complete.
   */
  function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (unverified || onboard.isPending) return;
    if (!form.store_name.trim() || !form.district.trim()) return;
    if (coordinateProblem(point)) return;

    onboard.mutate(
      {
        store_name: form.store_name.trim(),
        region: form.region,
        district: form.district.trim(),
        // Empty strings would be stored as empty strings; null says "not given".
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        description_uz: form.description_uz.trim() || null,
        ...coordinatePayload(point),
      },
      { onSuccess: onCreated },
    );
  }

  const error = onboard.error instanceof ApiError ? onboard.error.message : null;

  return (
    <form onSubmit={submit} className={className}>
      <div className="border border-border bg-card p-5">
        <h2 className="type-h3 mb-1">Do'kon ma'lumotlari</h2>
        <p className="type-caption mb-5">
          {alreadyHasStores
            ? "Sizda allaqachon do'kon bor. Bu forma yangi do'kon ochadi."
            : "Bu ma'lumotlar xaridorlarga ko'rinadi."}
        </p>

        <div className="space-y-4">
          <Field label="Do'kon nomi" error={nameError}>
            <Input
              value={form.store_name}
              onChange={(event) => setForm((prev) => ({ ...prev, store_name: event.target.value }))}
              maxLength={120}
              placeholder="Masalan: Avtodetal Servis"
              required
            />
          </Field>

          <Field label="Viloyat">
            <select
              className={inputClass}
              value={form.region}
              onChange={(event) => setForm((prev) => ({ ...prev, region: event.target.value }))}
            >
              {STORE_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tuman" error={districtError}>
            <Input
              value={form.district}
              onChange={(event) => setForm((prev) => ({ ...prev, district: event.target.value }))}
              maxLength={80}
              placeholder="Masalan: Chilonzor"
              required
            />
          </Field>

          <Field label="Manzil" hint="Ixtiyoriy. Xaridorlar olib ketishi uchun kerak bo'ladi.">
            <Input
              value={form.address}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              maxLength={250}
            />
          </Field>

          <Field label="Telefon" hint="Ixtiyoriy. Xaridor siz bilan bog'lanishi uchun.">
            <Input
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              maxLength={20}
              inputMode="tel"
              placeholder="+998 90 123 45 67"
            />
          </Field>

          <Field
            label="Do'kon haqida"
            hint="Ixtiyoriy. Nima sotasiz, nimasi bilan ajralib turasiz."
          >
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              value={form.description_uz}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description_uz: event.target.value }))
              }
              maxLength={2000}
            />
          </Field>

          {/*
           * The point is optional at this stage: someone filling this in from a
           * desk at home should not be blocked. It is the same picker as in the
           * settings screen, so it can be finished later standing at the shop
           * door.
           */}
          <div className="border-t border-border pt-4">
            <p className="type-label mb-1.5 text-muted-foreground">Do'kon joylashuvi</p>
            <p className="type-caption mb-3">
              Ixtiyoriy. Nuqta belgilansa, xaridor do'konni xaritadan topadi va yetkazib berish
              manzili aniq bo'ladi.
            </p>
            <LocationPicker value={point} onChange={setPoint} />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-5 flex items-start gap-2.5 border border-warning/40 bg-warning/10 px-4 py-3">
          <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p className="type-caption">
            Yangi do'kon «Tasdiqlanmoqda» holatida ochiladi. Mahsulot qo'shishingiz va omborni
            to'ldirishingiz mumkin, lekin katalogda ko'rinish va buyurtma qabul qilish administrator
            tasdig'idan keyin boshlanadi.
          </p>
        </div>

        <Button
          type="submit"
          className="mt-4 w-full"
          disabled={onboard.isPending || !valid || unverified}
        >
          {onboard.isPending ? "Yuborilmoqda…" : "Do'kon ochish"}
        </Button>
        {unverified && (
          <p className="type-caption mt-2">
            Do'kon ochish uchun avval aloqa raqamingizni tasdiqlang — kodni shu sahifaning tepasidan
            kiritasiz. Formani hozir to'ldirib turishingiz mumkin.
          </p>
        )}

        <ul className="mt-4 space-y-1.5">
          {["Ro'yxatdan o'tish bepul", "Oylik to'lov yo'q", "Istalgan vaqtda to'xtatasiz"].map(
            (line) => (
              <li key={line} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="size-3.5 shrink-0 text-success" aria-hidden />
                {line}
              </li>
            ),
          )}
        </ul>
      </div>
    </form>
  );
}

/**
 * What happens the moment the store exists.
 *
 * The person is not sent straight to the panel, for two reasons: they have just
 * been told their store is pending and should read that where they are, and the
 * logo can only be uploaded now — `POST /uploads` needs a store id, so there was
 * nothing to attach a file to a second ago.
 */
export function StoreCreatedCard({
  seller,
  onFinish,
  className = "space-y-4",
}: {
  seller: SellerStore;
  onFinish: () => void;
  className?: string | undefined;
}) {
  const update = useUpdateStore(seller.id);

  return (
    <div className={className}>
      <div className="border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-h3">Do'kon ochildi</h2>
          <Pill tone="warning">Tasdiqlanmoqda</Pill>
        </div>

        <p className="text-sm font-semibold">{seller.store_name}</p>
        <p className="type-caption mt-1">
          {seller.region}, {seller.district}
        </p>

        <div className="mt-4 flex items-start gap-2.5 border border-warning/40 bg-warning/10 px-4 py-3">
          <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p className="type-caption">
            Do'kon administrator ko'rigidan o'tmaguncha «Tasdiqlanmoqda» holatida turadi. Shu vaqt
            ichida mahsulot qo'shishingiz, ombor ochishingiz va narx belgilashingiz mumkin —
            tasdiqlangach hammasi katalogda birdan ko'rinadi.
          </p>
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <ImageUpload
            label="Logotip"
            hint="Endi yuklash mumkin: do'kon yaratildi. Keyinroq sozlamalardan ham o'zgartirasiz."
            purpose="STORE_LOGO"
            sellerId={seller.id}
            value={seller.logo_url ?? null}
            onUploaded={(file) => update.mutate({ logo_url: file.url })}
          />
          {update.isPending && (
            <p className="type-caption mt-2">Logotip do'konga biriktirilmoqda…</p>
          )}
          {update.isError && (
            <p className="mt-2 text-sm text-destructive">{update.error.message}</p>
          )}
          {update.isSuccess && !update.isPending && (
            <p className="mt-2 text-sm text-success">Logotip saqlandi.</p>
          )}
        </div>

        <Button className="mt-5 w-full" onClick={onFinish}>
          Sotuvchi paneliga o'tish
        </Button>
      </div>
    </div>
  );
}
