import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, Plus, Trash2 } from "lucide-react";
import { Page, PageTitle, EmptyState } from "@/components/motora/Page";
import { SectionHead } from "@/components/motora/Chrome";
import { ProductCard } from "@/components/motora/ProductCard";
import { products } from "@/data/demo";
import { useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/garage/")({
  head: () => ({
    meta: [
      { title: "Garaj — MOTORA" },
      {
        name: "description",
        content: "Mashinalaringizni saqlang va faqat mos keladigan detallarni ko'ring.",
      },
      { property: "og:title", content: "Garaj — MOTORA" },
      { property: "og:description", content: "Mashinangizga mos detallar avtomatik tanlanadi." },
    ],
  }),
  component: Garage,
});

function Garage() {
  const t = useT();
  const { vehicles, activeVehicleId, activeVehicle, setActiveVehicle, removeVehicle } = useStore();

  const compatible = activeVehicle
    ? products.filter((p) => p.fitsModels.includes(activeVehicle.model))
    : [];

  return (
    <Page>
      <PageTitle title={t("garage.title")} subtitle={t("garage.mine")} />

      {vehicles.length === 0 ? (
        <EmptyState
          title={t("home.noCar")}
          subtitle={t("home.noCarSub")}
          action={
            <Link
              to="/garage/add"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="size-4" />
              {t("garage.add")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className={cn(
                "rounded-xl border bg-card p-4 transition-colors",
                v.id === activeVehicleId ? "border-accent-electric" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-md bg-secondary">
                  <Car className="size-5" />
                </span>
                <button
                  type="button"
                  onClick={() => removeVehicle(v.id)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={t("common.remove")}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <p className="type-h3 mt-3">
                {v.brand} {v.model}
              </p>
              <p className="type-caption mt-1">
                {v.year} · {v.engine} · {v.transmission}
              </p>
              {v.vin && <p className="type-caption mt-1">VIN: {v.vin}</p>}
              {v.id === activeVehicleId ? (
                <p className="type-label mt-4 text-accent-electric">{t("garage.active")}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveVehicle(v.id)}
                  className="mt-4 w-full rounded-md border border-border px-3 py-2 text-sm font-semibold"
                >
                  {t("garage.setActive")}
                </button>
              )}
            </div>
          ))}

          <Link
            to="/garage/add"
            className="grid place-items-center rounded-xl border border-dashed border-border p-6 text-sm font-semibold text-muted-foreground transition-colors hover:border-accent-electric hover:text-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="size-4" />
              {t("garage.add")}
            </span>
          </Link>
        </div>
      )}

      {compatible.length > 0 && (
        <section className="mt-10">
          <SectionHead
            title={t("garage.compatible")}
            subtitle={`${activeVehicle?.brand} ${activeVehicle?.model} ${activeVehicle?.year}`}
          />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {compatible.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}
