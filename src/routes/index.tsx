import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, MapPin, ShieldCheck, Star, Truck } from "lucide-react";

import cobalt from "@/assets/car-cobalt.jpg";
import { HomeSlider } from "@/components/avtoqism/HomeSlider";
import { Page, SectionHead } from "@/components/avtoqism/Page";
import { ProductCard } from "@/components/avtoqism/ProductCard";
import { ErrorState, ProductGridSkeleton } from "@/components/avtoqism/States";
import { useLang, useT } from "@/lib/i18n";
import { useCategories, useProducts, useSellers } from "@/lib/query/catalog";
import { useActiveVehicle } from "@/lib/query/garage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AVTOQISM — Avtomobilingiz uchun aniq tanlov" },
      {
        name: "description",
        content:
          "Garajingizga mashinangizni qo'shing va faqat mos keladigan detallarni ko'ring. Toshkentdagi ishonchli sotuvchilar.",
      },
      { property: "og:title", content: "AVTOQISM — Avtomobilingiz uchun aniq tanlov" },
      {
        property: "og:description",
        content: "Mos detallar, sotuvchilar taqqoslovi va avto feed — bir joyda.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const t = useT();
  const { lang } = useLang();
  const { activeVehicle } = useActiveVehicle();

  const personalised = useProducts({
    fits_my_car: activeVehicle ? true : undefined,
    size: 8,
    sort: activeVehicle ? "relevance" : "popular",
  });
  const categories = useCategories();
  const sellers = useSellers();

  const title = activeVehicle
    ? `${activeVehicle.variant.display_name.split(" ").slice(0, 2).join(" ")}`
    : t("home.question");

  return (
    <Page>
      {/* --- ad slot: campaigns and house banners, already merged by the API - */}
      <HomeSlider />

      {/* --- hero ---------------------------------------------------------- */}
      <section className="grid items-center gap-8 pb-16 lg:grid-cols-[0.8fr_1.2fr] lg:pb-24">
        <div className="enter-rise flex flex-col justify-center">
          <p className="type-label mb-4 text-primary">
            {activeVehicle ? "Sizning avtomobilingiz" : "AVTOQISM"}
          </p>
          <h1 className="type-display">{title}</h1>
          <p className="mt-5 text-lg text-muted-foreground">
            {activeVehicle
              ? `${activeVehicle.year} · ${activeVehicle.variant.engine?.displacement_l ?? ""} · ${
                  activeVehicle.variant.transmission === "AUTOMATIC" ? "Avtomat" : "Mexanika"
                }`
              : t("home.noCarSub")}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/garage"
              className="inline-flex items-center gap-2 bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {activeVehicle ? t("home.openGarage") : t("home.addCar")}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 border border-border-strong bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-muted"
            >
              {t("nav.market")}
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-border pt-5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-5 text-success" /> {t("common.warranty")}
            </span>
            <span className="inline-flex items-center gap-2">
              <Truck className="size-5 text-primary" /> {t("common.delivery")}
            </span>
          </div>
        </div>

        <div className="relative min-h-[320px] overflow-hidden bg-muted lg:min-h-[520px]">
          <img
            src={cobalt}
            alt={activeVehicle?.variant.display_name ?? "Chevrolet Cobalt"}
            className="size-full object-cover"
          />
          {activeVehicle && (
            <div className="absolute bottom-4 left-4 bg-background px-4 py-3 shadow-sm">
              <p className="type-label text-muted-foreground">{t("garage.active")}</p>
              <p className="mt-1 text-sm font-semibold">
                {activeVehicle.variant.display_name} · {activeVehicle.year}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* --- personalised grid --------------------------------------------- */}
      <section className="border-t border-border py-14">
        <SectionHead
          eyebrow={activeVehicle ? "Siz uchun" : t("home.trending")}
          title={activeVehicle ? t("home.forYourCar") : t("home.trending")}
          subtitle={activeVehicle ? activeVehicle.variant.display_name : undefined}
          action={
            <Link
              to="/marketplace"
              search={activeVehicle ? { fit: true } : {}}
              className="inline-flex items-center gap-1 text-sm font-semibold hover:text-primary"
            >
              {t("common.viewAll")} <ChevronRight className="size-4" />
            </Link>
          }
        />

        {personalised.isPending ? (
          <ProductGridSkeleton count={8} />
        ) : personalised.isError ? (
          <ErrorState error={personalised.error} onRetry={() => void personalised.refetch()} />
        ) : personalised.data.items.length === 0 ? (
          <p className="type-caption">{t("market.nothing")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-8">
            {personalised.data.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* --- categories ----------------------------------------------------- */}
      <section className="border-t border-border py-14">
        <SectionHead eyebrow={t("home.categories")} title="Keraklisini tez toping" />
        {categories.isPending ? (
          <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-32 animate-pulse bg-card" />
            ))}
          </div>
        ) : categories.isError ? (
          <ErrorState error={categories.error} onRetry={() => void categories.refetch()} compact />
        ) : (
          <div className="grid grid-cols-2 border-l border-t border-border md:grid-cols-4">
            {categories.data
              .filter((c) => c.product_count > 0)
              .map((c, i) => (
                <Link
                  key={c.id}
                  to="/marketplace"
                  search={{ category: c.slug }}
                  className="group flex min-h-32 flex-col justify-between border-b border-r border-border p-5 transition-colors hover:bg-muted"
                >
                  <span className="type-caption">
                    {String(i + 1).padStart(2, "0")} · {c.product_count}
                  </span>
                  <span className="flex items-end justify-between font-semibold">
                    {lang === "uz" ? c.name_uz : (c.name_ru ?? c.name_uz)}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
          </div>
        )}
      </section>

      {/* --- sellers --------------------------------------------------------- */}
      <section className="border-t border-border py-14">
        <SectionHead eyebrow="Yaqiningizda" title={t("home.nearby")} />
        {sellers.isPending ? (
          <div className="grid gap-px bg-border md:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-44 animate-pulse bg-card" />
            ))}
          </div>
        ) : sellers.isError ? (
          <ErrorState error={sellers.error} onRetry={() => void sellers.refetch()} compact />
        ) : (
          <div className="grid gap-px bg-border md:grid-cols-3">
            {sellers.data.slice(0, 6).map((s) => (
              <div key={s.id} className="bg-background p-6">
                <div className="flex items-start justify-between">
                  <div className="grid size-11 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
                    {s.store_name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold">
                    <Star className="size-4 fill-primary text-primary" />
                    {Number(s.rating_avg).toFixed(1)}
                  </span>
                </div>
                <h3 className="type-h3 mt-8">{s.store_name}</h3>
                <p className="type-caption mt-2 flex items-center gap-1">
                  <MapPin className="size-4" />
                  {s.district}, {s.region}
                </p>
                <p className="type-caption mt-1">
                  {s.rating_count} {t("common.reviews").toLowerCase()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
