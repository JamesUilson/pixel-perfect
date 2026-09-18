import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Car, ShieldCheck, Star, Truck } from "lucide-react";
import { Page } from "@/components/motora/Page";
import { SectionHead } from "@/components/motora/Chrome";
import { ProductCard } from "@/components/motora/ProductCard";
import { categories, products, sellers, videos, carImage } from "@/data/demo";
import { useLang, useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { formatCompact } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MOTORA — Mashinangiz uchun ehtiyot qismlar" },
      {
        name: "description",
        content:
          "Garajingizga mashina qo'shing va faqat mos keladigan detallarni ko'ring. Toshkentdagi ishonchli sotuvchilar.",
      },
      { property: "og:title", content: "MOTORA — Mashinangiz uchun ehtiyot qismlar" },
      {
        property: "og:description",
        content: "Mos detallar, sotuvchilar taqqoslovi va avto lenta — bir joyda.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const t = useT();
  const { lang } = useLang();
  const { activeVehicle } = useStore();

  const fitting = activeVehicle
    ? products.filter((p) => p.fitsModels.includes(activeVehicle.model))
    : products;
  const deals = products.filter((p) => p.oldPrice);

  return (
    <Page>
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid items-center gap-8 p-6 lg:grid-cols-2 lg:p-10">
          <div>
            <span className="type-label text-accent-electric">MOTORA</span>
            <h1 className="type-display mt-3">{t("home.question")}</h1>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">{t("home.noCarSub")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/garage"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                <Car className="size-4" />
                {activeVehicle ? t("home.openGarage") : t("home.addCar")}
              </Link>
              <Link
                to="/marketplace"
                className="inline-flex items-center gap-2 rounded-md border border-border-strong px-5 py-3 text-sm font-semibold"
              >
                {t("nav.market")}
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-5 type-caption">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-success" /> {t("common.warranty")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck className="size-4 text-accent-electric" /> {t("common.delivery")}
              </span>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-secondary">
            <img src={carImage} alt="Chevrolet Cobalt" className="size-full object-cover" />
            {activeVehicle && (
              <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-card/95 px-3 py-2 backdrop-blur">
                <p className="type-label text-muted-foreground">{t("garage.active")}</p>
                <p className="text-sm font-bold">
                  {activeVehicle.brand} {activeVehicle.model} {activeVehicle.year}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <SectionHead title={t("home.categories")} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <Link
              key={c.id}
              to="/marketplace"
              search={{ category: c.id }}
              className="rounded-xl border border-border bg-card px-4 py-5 text-sm font-semibold transition-colors hover:border-accent-electric"
            >
              {lang === "uz" ? c.uz : c.ru}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionHead
          title={activeVehicle ? t("home.forYourCar") : t("home.trending")}
          subtitle={
            activeVehicle
              ? `${activeVehicle.brand} ${activeVehicle.model} ${activeVehicle.year}`
              : undefined
          }
          action={
            <Link to="/marketplace" className="text-sm font-semibold text-accent-electric">
              {t("common.viewAll")}
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {fitting.slice(0, 8).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {deals.length > 0 && (
        <section className="mt-10">
          <SectionHead title={t("home.deals")} />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {deals.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <SectionHead
          title={t("home.fromFeed")}
          action={
            <Link to="/feed" className="text-sm font-semibold text-accent-electric">
              {t("common.viewAll")}
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {videos.map((v) => (
            <Link
              key={v.id}
              to="/feed"
              className="group overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="aspect-[9/12] overflow-hidden bg-secondary">
                <img
                  src={v.poster}
                  alt={lang === "uz" ? v.titleUz : v.titleRu}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <p className="type-h3 line-clamp-2">{lang === "uz" ? v.titleUz : v.titleRu}</p>
                <p className="type-caption mt-1">
                  {v.authorName} · {formatCompact(v.likes)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionHead title={t("home.nearby")} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sellers.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4">
              <p className="type-h3">{s.name}</p>
              <p className="type-caption mt-1">{s.district}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
                <Star className="size-4 fill-warning text-warning" />
                {s.rating}
                <span className="type-caption">({s.reviews})</span>
              </p>
              <p className="type-caption mt-2">{lang === "uz" ? s.deliveryUz : s.deliveryRu}</p>
            </div>
          ))}
        </div>
      </section>
    </Page>
  );
}
