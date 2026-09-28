/**
 * Becoming a seller, for somebody who already has a verified account.
 *
 * This is the one panel screen a person reaches before they have a store, so
 * it sits outside the panel shell and explains the deal before asking for
 * anything: what it costs, what happens to the money, and what has to be true
 * before the first order can arrive. Someone should be able to decide from
 * this page whether AVTOQISM is worth their time.
 *
 * The form itself and the panel that replaces it now live in
 * `components/avtoqism/account/StoreDetailsForm.tsx`, because `/register/seller`
 * asks for exactly the same store details from somebody who has no account
 * yet. This page is what it always was — the pitch, plus that form.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Megaphone, Percent, Truck, Wallet } from "lucide-react";

import { Page, PageTitle } from "@/components/avtoqism/Page";
import { SignInRequired } from "@/components/avtoqism/SignInRequired";
import { StoreCreatedCard, StoreDetailsForm } from "@/components/avtoqism/account/StoreDetailsForm";
import { VerificationPrompt } from "@/components/avtoqism/auth/VerificationPrompt";
import { isUnverified, useMe } from "@/lib/query/auth";
import { useIsAuthenticated } from "@/lib/query/session";
import { useMyStores } from "@/lib/query/seller";
import type { SellerStore } from "@/lib/query/seller";

export const Route = createFileRoute("/seller_/onboard")({
  head: () => ({
    meta: [
      { title: "Sotuvchi bo'lish — AVTOQISM" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SellerOnboard,
});

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
  const me = useMe();
  const stores = useMyStores();
  const navigate = useNavigate();

  // The store is kept here rather than navigated away from, because the logo
  // cannot be uploaded until the store exists: `POST /uploads` refuses a
  // store-scoped file without a store id.
  const [created, setCreated] = useState<SellerStore | null>(null);

  if (!signedIn) return <SignInRequired />;

  /*
   * `POST /sellers/onboard` is in the server's `VERIFIED_ONLY_ACTIONS`, so an
   * unverified account is refused — and until now it was refused *after*
   * filling in the store name, the district and the map point. The rule is
   * known before any of that, so it is said before any of that, and the code
   * can be entered here rather than sending somebody to the profile screen to
   * find it.
   */
  const unverified = isUnverified(me.data);
  const alreadyHasStores = (stores.data ?? []).length > 0;

  return (
    <Page>
      {/* Approval belongs in the first sentence somebody reads, not only in the
          warning box beside the submit button — it decides whether this is worth
          their afternoon. */}
      <PageTitle
        eyebrow="AVTOQISM"
        title="Do'kon ochish"
        subtitle="Ro'yxatdan o'tish bepul, komissiya faqat sotuvdan olinadi. Yangi do'kon administrator tasdig'idan keyin katalogda ko'rinadi."
      />

      {/* Renders nothing for a verified account. For an unverified one it is the
          whole reason the form below will not submit, so it goes first. */}
      <VerificationPrompt
        user={me.data}
        onVerified={() => void me.refetch()}
        className="mb-8 border border-warning/40 bg-warning/10 p-5"
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

        {created ? (
          <StoreCreatedCard
            seller={created}
            onFinish={() => void navigate({ to: "/seller" })}
            className="space-y-4 lg:sticky lg:top-24"
          />
        ) : (
          <StoreDetailsForm
            unverified={unverified}
            alreadyHasStores={alreadyHasStores}
            onCreated={setCreated}
            className="space-y-4 lg:sticky lg:top-24"
          />
        )}
      </div>
    </Page>
  );
}
