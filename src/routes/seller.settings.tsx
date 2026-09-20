/**
 * Do'kon sozlamalari.
 *
 * Only some of a store is the seller's to change. The name, the slug and the
 * region are what a buyer recognises and what an invoice is issued against, so
 * the API does not accept them here — `PATCH /sellers/{id}` takes the logo, the
 * description, the address, the phone and the working hours, and nothing else.
 * Rather than render a form that silently drops half of what is typed into it,
 * the screen shows the fixed facts as facts and the editable ones as a form.
 */
import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Package,
  Wallet,
  Warehouse,
} from "lucide-react";

import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import { useSellerScope } from "@/components/avtoqism/panel/SellerContext";
import { Button, Field, Input, Pill, inputClass } from "@/components/avtoqism/panel/Widgets";
import { safeApi } from "@/lib/api/client";
import type { SellerOut, SellerUpdateIn } from "@/lib/api/types";
import { formatPhone, groupDigits } from "@/lib/format";
import { qk } from "@/lib/query/keys";

export const Route = createFileRoute("/seller/settings")({
  head: () => ({
    meta: [{ title: "Do'kon sozlamalari — AVTOQISM" }, { name: "robots", content: "noindex" }],
  }),
  component: SellerSettings,
});

const STATUS_UZ: Record<string, { label: string; tone: "good" | "warning" | "critical" }> = {
  PENDING: { label: "Tasdiqlanmoqda", tone: "warning" },
  ACTIVE: { label: "Faol", tone: "good" },
  SUSPENDED: { label: "To'xtatilgan", tone: "critical" },
  REJECTED: { label: "Rad etilgan", tone: "critical" },
};

const VERIFICATION_UZ: Record<string, string> = {
  BASIC: "Oddiy",
  BUSINESS_VERIFIED: "Biznes tasdiqlangan",
  TRUSTED_SELLER: "Ishonchli sotuvchi",
};

const PANEL_LINKS = [
  {
    to: "/seller",
    label: "Boshqaruv",
    icon: LayoutDashboard,
    body: "Savdo, pul va ogohlantirishlar.",
  },
  {
    to: "/seller/orders",
    label: "Buyurtmalar",
    icon: ClipboardList,
    body: "Kelgan buyurtmalarni yuritish.",
  },
  { to: "/seller/products", label: "Mahsulotlar", icon: Package, body: "Katalog va narxlar." },
  {
    to: "/seller/warehouses",
    label: "Omborlar",
    icon: Warehouse,
    body: "Qoldiq va harakatlar tarixi.",
  },
  {
    to: "/seller/finance",
    label: "Moliya",
    icon: Wallet,
    body: "Balans, pul yechish, hisob daftari.",
  },
  {
    to: "/seller/promotions",
    label: "Aksiyalar",
    icon: BadgePercent,
    body: "Chegirma va promokodlar.",
  },
  { to: "/seller/ads", label: "Reklama", icon: Megaphone, body: "Kampaniyalar va bannerlar." },
] as const;

/**
 * The one mutation this screen owns. It lives here rather than in the shared
 * hook file because it is the only caller: the store PATCH is a settings-screen
 * concern, and the panel reads the store from `/sellers/me`, which is what gets
 * invalidated on success.
 */
function useUpdateStore(sellerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SellerUpdateIn) =>
      safeApi<SellerOut>(`/sellers/${sellerId}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.myStores });
      void queryClient.invalidateQueries({ queryKey: qk.sellerScope(sellerId) });
    },
  });
}

function SellerSettings() {
  const { seller } = useSellerScope();

  return (
    <div className="space-y-6">
      <StoreSummary seller={seller} />
      <StoreForm key={seller.id} seller={seller} />

      <PanelSection title="Panel bo'limlari" subtitle="Do'konni boshqarishning qolgan qismi.">
        <ul className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
          {PANEL_LINKS.map((item) => (
            <li key={item.to} className="bg-card">
              <Link to={item.to} className="flex h-full gap-3 p-5 transition-colors hover:bg-muted">
                <item.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="type-caption mt-1 block">{item.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PanelSection>
    </div>
  );
}

/* --- read-only facts --------------------------------------------------------- */
function StoreSummary({ seller }: { seller: SellerOut }) {
  const status = STATUS_UZ[seller.status] ?? { label: seller.status, tone: "warning" as const };
  const facts: { label: string; value: string }[] = [
    { label: "Nomi", value: seller.store_name },
    { label: "Manzil belgisi", value: `/${seller.slug}` },
    { label: "Viloyat / tuman", value: `${seller.region}, ${seller.district}` },
    { label: "Manzil", value: seller.address ?? "—" },
    { label: "Telefon", value: seller.phone ? formatPhone(seller.phone) : "—" },
    {
      label: "Reyting",
      value:
        seller.rating_count > 0
          ? `${seller.rating_avg} (${groupDigits(seller.rating_count)} baho)`
          : "Hali baho yo'q",
    },
    { label: "Sotilgan mahsulotlar", value: `${groupDigits(seller.sold_count)} dona` },
    {
      label: "Tasdiqlanish darajasi",
      value: VERIFICATION_UZ[seller.verification_level] ?? seller.verification_level,
    },
  ];

  return (
    <PanelSection
      title="Do'kon haqida"
      subtitle="Bu ma'lumotlar xaridorga ko'rinadi."
      action={<Pill tone={status.tone}>{status.label}</Pill>}
    >
      <dl className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="bg-card p-5">
            <dt className="type-label text-muted-foreground">{fact.label}</dt>
            <dd className="mt-1.5 break-words text-sm font-medium">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </PanelSection>
  );
}

/* --- editable fields ----------------------------------------------------------- */
function StoreForm({ seller }: { seller: SellerOut }) {
  const update = useUpdateStore(seller.id);

  const [logoUrl, setLogoUrl] = useState(seller.logo_url ?? "");
  const [descriptionUz, setDescriptionUz] = useState(seller.description_uz ?? "");
  const [address, setAddress] = useState(seller.address ?? "");
  const [phone, setPhone] = useState(seller.phone ?? "");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    update.mutate({
      logo_url: logoUrl.trim() || null,
      description_uz: descriptionUz.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
    });
  }

  return (
    <PanelSection
      title="Do'kon ma'lumotlari"
      subtitle="Do'kon nomi, manzil belgisi va viloyat qo'llab-quvvatlash xizmati orqali o'zgartiriladi."
    >
      <form className="space-y-4 p-5" onSubmit={submit}>
        <Field label="Logotip manzili" hint="Kvadrat rasm eng yaxshi ko'rinadi.">
          <Input
            type="url"
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            placeholder="https://…"
          />
        </Field>

        <Field label="Do'kon haqida" hint="Nima sotasiz, qaysi brendlar bilan ishlaysiz.">
          <textarea
            className={`${inputClass} min-h-28 resize-y`}
            value={descriptionUz}
            onChange={(event) => setDescriptionUz(event.target.value)}
            maxLength={1000}
          />
        </Field>

        <Field label="Manzil" hint="Mijoz olib ketishi mumkin bo'lgan asosiy nuqta.">
          <Input value={address} onChange={(event) => setAddress(event.target.value)} />
        </Field>

        <Field label="Telefon">
          <Input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+998901234567"
          />
        </Field>

        {update.isError && <p className="text-sm text-destructive">{update.error.message}</p>}
        {update.isSuccess && !update.isPending && <p className="text-sm text-success">Saqlandi.</p>}

        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
      </form>
    </PanelSection>
  );
}
