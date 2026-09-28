import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight } from "lucide-react";

import { HomeSlider, type LocalSlide } from "@/components/avtoqism/HomeSlider";
import { Page, SectionHead } from "@/components/avtoqism/Page";
import { ProductCard } from "@/components/avtoqism/ProductCard";
import { ErrorState, ProductGridSkeleton } from "@/components/avtoqism/States";
import { HeroSlide } from "@/components/avtoqism/home/HeroSlide";
import { NearbyStores } from "@/components/avtoqism/home/NearbyStores";
import { useLang, useT } from "@/lib/i18n";
import { useCategories, useProducts } from "@/lib/query/catalog";
import { useActiveVehicle } from "@/lib/query/garage";

/**
 * The hero, as the band's first slide.
 *
 * A module constant rather than an object built in the component: `HomeSlider`
 * keys its panel list off this, and a fresh object every render would rebuild
 * that list for nothing. It carries no props of its own — `HeroSlide` reads the
 * garage itself — so there is nothing here to close over.
 */
const HERO_SLIDE: LocalSlide = {
  id: "hero",
  label: "Asosiy taklif",
  render: (active) => <HeroSlide active={active} />,
};

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

  return (
    <Page>
      {/* --- the band ------------------------------------------------------
       * One rotating strip, not two stacked ones: the hero is the first slide
       * and the API's merged campaigns and house banners are the rest.
       */}
      <HomeSlider leading={HERO_SLIDE} />

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

      {/* --- stores near the visitor ---------------------------------------
       * Owns its own data, its own permission prompt and its own map, because
       * all three are one question and splitting them across the route would
       * put a geolocation call in a component that renders on every visit.
       */}
      <NearbyStores />
    </Page>
  );
}
