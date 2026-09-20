/**
 * Becoming a seller.
 *
 * This is the one panel screen a person reaches before they have a store, so
 * it sits outside the panel shell and explains the deal before asking for
 * anything: what it costs, what happens to the money, and what has to be true
 * before the first order can arrive. Someone should be able to decide from
 * this page whether AVTOQISM is worth their time.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Check, Megaphone, Percent, Truck, Wallet } from "lucide-react";

import { Page, PageTitle } from "@/components/avtoqism/Page";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { Button, Field, Input, inputClass } from "@/components/avtoqism/panel/Widgets";
import { ApiError } from "@/lib/api/client";
import { useIsAuthenticated } from "@/lib/query/session";
import { useMyStores, useOnboardSeller } from "@/lib/query/seller";

export const Route = createFileRoute("/seller_/onboard")({
  head: () => ({
    meta: [
      { title: "Sotuvchi bo'lish — AVTOQISM" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SellerOnboard,
});

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

/** What a seller gets, in the order they will care about it. */
const BENEFITS = [
  {
    icon: Percent,
    title: "Komissiya 8%",
    body: "Faqat sotilgan mahsulotdan olinadi. Oylik to'lov, ro'yxatdan o'tish puli yoki yashirin xarajat yo'q. Chegirma e'lon qilsangiz, komissiya chegirmadan keyingi summadan hisoblanadi.",
  },
  {
    icon: Wallet,
    title: "Pul kafolati",
    body: "Xaridor to'lovi platformada saqlanadi va buyurtma yetkazilgach hisobingizga ochiladi. Har bir so'mning qayerdaligi hisob daftarida ko'rinib turadi.",
  },
  {
    icon: Boxes,
    title: "Ombor tizimi",
    body: "Bir nechta filial, har bir javondagi qoldiq, kirim-chiqim tarixi va tugab qolganlar haqida ogohlantirish. Excelga yuklab olish har joyda bor.",
  },
  {
    icon: Megaphone,
    title: "Reklama va aksiyalar",
    body: "Bosh sahifa slayderi, qidiruv tepasi, chegirmalar va promokodlar — byudjetni o'zingiz belgilaysiz, sarfni real vaqtda ko'rasiz.",
  },
];

/** What has to be done before the first order can be fulfilled. */
const STEPS = [
  "Do'kon ma'lumotlarini kiriting — nomi, hududi va aloqa telefoni.",
  "Administrator do'konni tekshiradi. Bu vaqtda ham mahsulot qo'shishingiz mumkin.",
  "Mahsulotlaringizga narx va qoldiq belgilang.",
  "Omborlaringizni sozlang — kamida bitta asosiy ombor kerak.",
  "Do'kon tasdiqlangach mahsulotlar katalogda ko'rinadi va buyurtma qabul qila boshlaysiz.",
];

function SellerOnboard() {
  const signedIn = useIsAuthenticated();
  const stores = useMyStores();
  const onboard = useOnboardSeller();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    store_name: "",
    region: REGIONS[0] as string,
    district: "",
    address: "",
    phone: "",
    description_uz: "",
  });
  const [touched, setTouched] = useState(false);

  if (!signedIn) return <SignInRequired />;

  const nameError =
    touched && form.store_name.trim().length < 2 ? "Do'kon nomini kiriting." : undefined;
  const districtError =
    touched && form.district.trim().length < 2 ? "Tumanni kiriting." : undefined;
  const valid = !nameError && !districtError && form.store_name && form.district;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!form.store_name.trim() || !form.district.trim()) return;

    const seller = await onboard.mutateAsync({
      store_name: form.store_name.trim(),
      region: form.region,
      district: form.district.trim(),
      // Empty strings would be stored as empty strings; null says "not given".
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      description_uz: form.description_uz.trim() || null,
    });
    if (seller) void navigate({ to: "/seller" });
  }

  const error = onboard.error instanceof ApiError ? onboard.error.message : null;
  const alreadyHasStores = (stores.data ?? []).length > 0;

  return (
    <Page>
      <PageTitle
        eyebrow="AVTOQISM"
        title="Do'kon ochish"
        subtitle="Ro'yxatdan o'tish bepul. Komissiya faqat sotuvdan olinadi."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        <div className="space-y-10">
          <section>
            <h2 className="type-h2 mb-5">Nima olasiz</h2>
            <div className="grid gap-px bg-border sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <div key={benefit.title} className="bg-card p-5">
                  <benefit.icon className="mb-3 size-5 text-primary" aria-hidden />
                  <h3 className="type-h3">{benefit.title}</h3>
                  <p className="type-caption mt-2">{benefit.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="type-h2 mb-5">Keyin nima bo'ladi</h2>
            <ol className="space-y-3">
              {STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-6 shrink-0 place-items-center bg-primary text-xs font-bold text-primary-foreground"
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <h3 className="type-h3">Yetkazib berish</h3>
                <p className="type-caption mt-2">
                  Yetkazishni kuryer xizmati orqali yoki o'zingiz tashkil qilishingiz mumkin.
                  Xaridor do'koningizdan olib ketishni ham tanlashi mumkin — buning uchun omborda
                  «mijozlar olib ketishi mumkin» belgisini yoqing.
                </p>
              </div>
            </div>
          </section>
        </div>

        <form onSubmit={(event) => void submit(event)} className="space-y-4 lg:sticky lg:top-24">
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
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, store_name: event.target.value }))
                  }
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
                  {REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Tuman" error={districtError}>
                <Input
                  value={form.district}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, district: event.target.value }))
                  }
                  maxLength={80}
                  placeholder="Masalan: Chilonzor"
                  required
                />
              </Field>

              <Field label="Manzil" hint="Ixtiyoriy. Xaridorlar olib ketishi uchun kerak bo'ladi.">
                <Input
                  value={form.address}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, address: event.target.value }))
                  }
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
            </div>

            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

            <Button type="submit" className="mt-5 w-full" disabled={onboard.isPending || !valid}>
              {onboard.isPending ? "Yuborilmoqda…" : "Do'kon ochish"}
            </Button>

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
      </div>
    </Page>
  );
}
