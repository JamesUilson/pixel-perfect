/**
 * Do'kon sozlamalari.
 *
 * Only some of a store is the seller's to change. The name, the slug and the
 * region are what a buyer recognises and what an invoice is issued against, so
 * the screen shows the fixed facts as facts and the editable ones as forms
 * rather than rendering fields that are silently dropped.
 *
 * Three of those forms matter more than the rest: where the shop is, what it
 * looks like in a listing, and what papers have been sent in for approval. A
 * store with no map point cannot be driven to, a store with no logo is a grey
 * square in the marketplace, and a store with no documents sits in the review
 * queue indefinitely.
 */
import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BadgePercent,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  Megaphone,
  Package,
  Wallet,
  Warehouse,
} from "lucide-react";

import { DocumentUpload, ImageUpload } from "@/components/avtoqism/panel/ImageUpload";
import {
  LocationPicker,
  coordinateProblem,
  coordinatePayload,
  coordinatesOf,
} from "@/components/avtoqism/panel/LocationPicker";
import type { Coordinates } from "@/components/avtoqism/panel/LocationPicker";
import { PanelSection } from "@/components/avtoqism/panel/PanelShell";
import { useSellerScope } from "@/components/avtoqism/panel/SellerContext";
import { Button, Field, Input, Pill, inputClass } from "@/components/avtoqism/panel/Widgets";
import { formatPhone, groupDigits } from "@/lib/format";
import { useMyStores, useMyUploads, useUpdateStore } from "@/lib/query/seller";
import type { SellerStore } from "@/lib/query/seller";

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

function SellerSettings() {
  const { seller } = useSellerScope();
  // The panel scope is typed against the generated schema, which is a release
  // behind the map point and the two new images. `/sellers/me` is already in
  // the cache, so reading the fuller record costs nothing.
  const stores = useMyStores();
  const store: SellerStore = stores.data?.find((row) => row.id === seller.id) ?? seller;

  return (
    <div className="space-y-6">
      <StoreSummary seller={store} />
      <StoreForm key={store.id} seller={store} />
      <StoreLocation key={`${store.id}-location`} seller={store} />
      <StoreImages seller={store} />
      <StoreDocuments seller={store} />

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
function StoreSummary({ seller }: { seller: SellerStore }) {
  const status = STATUS_UZ[seller.status] ?? { label: seller.status, tone: "warning" as const };
  const facts: { label: string; value: string }[] = [
    { label: "Nomi", value: seller.store_name },
    { label: "Manzil belgisi", value: `/${seller.slug}` },
    { label: "Viloyat / tuman", value: `${seller.region}, ${seller.district}` },
    { label: "Manzil", value: seller.address ?? "—" },
    { label: "Telefon", value: seller.phone ? formatPhone(seller.phone) : "—" },
    {
      label: "Xarita nuqtasi",
      value:
        seller.latitude && seller.longitude
          ? `${seller.latitude}, ${seller.longitude}`
          : "Belgilanmagan",
    },
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
function StoreForm({ seller }: { seller: SellerStore }) {
  const update = useUpdateStore(seller.id);

  const [descriptionUz, setDescriptionUz] = useState(seller.description_uz ?? "");
  const [address, setAddress] = useState(seller.address ?? "");
  const [phone, setPhone] = useState(seller.phone ?? "");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    update.mutate({
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

/* --- the point on the map -------------------------------------------------------- */
function StoreLocation({ seller }: { seller: SellerStore }) {
  const update = useUpdateStore(seller.id);
  const [point, setPoint] = useState<Coordinates>(coordinatesOf(seller));

  const problem = coordinateProblem(point);
  // A half-filled pair is a 422 from the server; catching it here keeps the
  // button honest, but the server's own message still wins when it speaks.
  const serverError = update.isError ? update.error.message : undefined;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (problem) return;
    update.mutate(coordinatePayload(point));
  }

  return (
    <PanelSection
      title="Do'kon joylashuvi"
      subtitle="Xaridor xaritadan topadi, kuryer esa shu nuqtaga boradi."
      action={
        seller.map_url ? (
          <a
            href={seller.map_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Nuqta havolasi
          </a>
        ) : undefined
      }
    >
      <form className="space-y-4 p-5" onSubmit={submit}>
        <LocationPicker
          value={point}
          onChange={setPoint}
          saved={{
            latitude: seller.latitude ?? null,
            longitude: seller.longitude ?? null,
            mapUrl: seller.map_url ?? null,
            navigatorUrl: seller.navigator_url ?? null,
          }}
          {...(serverError ? { serverError } : {})}
        />

        {update.isSuccess && !update.isPending && (
          <p className="text-sm text-success">Joylashuv saqlandi.</p>
        )}

        <Button type="submit" disabled={update.isPending || problem !== null}>
          {update.isPending ? "Saqlanmoqda…" : "Joylashuvni saqlash"}
        </Button>
      </form>
    </PanelSection>
  );
}

/* --- the three store images ------------------------------------------------------ */
/**
 * Each upload is attached to the store the moment it lands. Two steps — upload,
 * then press save — is how a seller ends up with a file on the server that
 * nothing points at.
 */
function StoreImages({ seller }: { seller: SellerStore }) {
  const update = useUpdateStore(seller.id);

  return (
    <PanelSection title="Do'kon rasmlari" subtitle="Yuklangan rasm darhol do'konga biriktiriladi.">
      <div className="grid gap-px bg-border lg:grid-cols-3">
        <div className="bg-card p-5">
          <ImageUpload
            label="Logotip"
            hint="Do'kon sahifasining tepasida ko'rinadi."
            purpose="STORE_LOGO"
            sellerId={seller.id}
            value={seller.logo_url ?? null}
            onUploaded={(file) => update.mutate({ logo_url: file.url })}
          />
        </div>
        <div className="bg-card p-5">
          <ImageUpload
            label="Kvadrat belgi"
            hint="Ro'yxatlarda va izohlarda ishlatiladi. Kvadrat rasm yuklang."
            purpose="STORE_ICON"
            sellerId={seller.id}
            value={seller.icon_url ?? null}
            onUploaded={(file) => update.mutate({ icon_url: file.url })}
          />
        </div>
        <div className="bg-card p-5">
          <ImageUpload
            label="Keng banner"
            hint="Do'kon sahifasining sarlavhasi. Keng rasm yuklang."
            purpose="STORE_BANNER"
            sellerId={seller.id}
            value={seller.banner_url ?? null}
            shape="wide"
            onUploaded={(file) => update.mutate({ banner_url: file.url })}
          />
        </div>
      </div>
      {(update.isError || update.isPending) && (
        <div className="border-t border-border px-5 py-3">
          {update.isPending && <p className="type-caption">Rasm do'konga biriktirilmoqda…</p>}
          {update.isError && <p className="text-sm text-destructive">{update.error.message}</p>}
        </div>
      )}
    </PanelSection>
  );
}

/* --- papers for the approval queue ------------------------------------------------ */
function StoreDocuments({ seller }: { seller: SellerStore }) {
  const uploads = useMyUploads();
  const documents = (uploads.data ?? []).filter(
    (file) => file.purpose === "SELLER_DOCUMENT" && file.seller_id === seller.id,
  );
  const pending = seller.status === "PENDING";

  return (
    <PanelSection
      title="Tasdiqlash hujjatlari"
      subtitle="Administrator do'konni shu hujjatlar asosida ko'rib chiqadi."
      action={
        pending ? <Pill tone="warning">Navbatda</Pill> : <Pill tone="neutral">Ixtiyoriy</Pill>
      }
    >
      <div className="space-y-4 p-5">
        <DocumentUpload
          sellerId={seller.id}
          documents={documents}
          // The list comes from `/uploads/me`, which the upload hook
          // invalidates, so a new paper appears without any local bookkeeping.
          onUploaded={() => undefined}
        />
        {uploads.isError && (
          <p className="text-sm text-destructive">
            Yuborilgan hujjatlar ro'yxatini olib bo'lmadi. Sahifani yangilab ko'ring.
          </p>
        )}
      </div>
    </PanelSection>
  );
}
